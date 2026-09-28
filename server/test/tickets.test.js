import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { Ticket } from '../src/models/Ticket.js';

test('ticket API lifecycle and ownership', async t => {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.APP_ORIGIN = 'http://127.0.0.1:5173';
  process.env.NODE_ENV = 'test';
  const db = `helpdesk_test_${randomUUID().replaceAll('-', '')}`;
  await connectDatabase(`mongodb://127.0.0.1:27017/${db}`);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  let ownerCookie, otherCookie, ownerId, otherId, ticketId;
  const valid = { title: 'Cannot access my account', description: 'My sign-in page shows an unexpected error.', category: 'Account', priority: 'High' };
  async function request(path, method = 'GET', body, cookie = ownerCookie, origin = process.env.APP_ORIGIN) {
    const response = await fetch(baseUrl + path, { method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  try {
    await Promise.all([User.init(), Ticket.init(), Session.init()]);
    for (const [email, isOwner] of [['owner@example.com', true], ['other@example.com', false]]) {
      const result = await request('/auth/register', 'POST', { name: 'Test User', email, password: 'test-only-password', confirmPassword: 'test-only-password' }, null);
      assert.equal(result.status, 201);
      if (isOwner) { ownerCookie = result.cookie; ownerId = result.data.user.id; }
      else { otherCookie = result.cookie; otherId = result.data.user.id; }
    }
    await t.test('all ticket operations require login', async () => {
      const id = new mongoose.Types.ObjectId();
      for (const [path, method, body] of [['/tickets', 'GET'], ['/tickets', 'POST', valid], [`/tickets/${id}`, 'GET'], [`/tickets/${id}`, 'PATCH', { status: 'Resolved' }], [`/tickets/${id}`, 'DELETE']]) {
        assert.equal((await request(path, method, body, null)).status, 401);
      }
    });
    await t.test('empty list, invalid input, and cross-origin writes', async () => {
      assert.deepEqual((await request('/tickets')).data.tickets, []);
      const invalid = await request('/tickets', 'POST', {});
      assert.equal(invalid.status, 400);
      assert.ok(invalid.data.errors.title);
      assert.equal((await request('/tickets', 'POST', valid, ownerCookie, 'https://attacker.example')).status, 403);
      assert.equal(await Ticket.countDocuments(), 0);
    });
    await t.test('create forces current owner and Open status, and persists details', async () => {
      const result = await request('/tickets', 'POST', { ...valid, owner: otherId, status: 'Resolved' });
      assert.equal(result.status, 201);
      ticketId = result.data.ticket.id;
      assert.equal(result.data.ticket.status, 'Open');
      const saved = await Ticket.findById(ticketId);
      assert.equal(saved.owner.toString(), ownerId);
      assert.equal(saved.priority, 'High');
      assert.ok(saved.createdAt instanceof Date);
      assert.equal((await request(`/tickets/${ticketId}`)).data.ticket.description, valid.description);
      assert.equal((await request('/tickets')).data.pagination.total, 1);
    });
    await t.test('other user cannot list, read, modify, or delete the ticket', async () => {
      assert.equal((await request('/tickets?owner=' + ownerId, 'GET', undefined, otherCookie)).data.tickets.length, 0);
      for (const [method, body] of [['GET'], ['PATCH', { status: 'Resolved' }], ['DELETE']]) {
        assert.equal((await request(`/tickets/${ticketId}`, method, body, otherCookie)).status, 404);
      }
      assert.equal((await Ticket.findById(ticketId)).status, 'Open');
    });
    await t.test('status updates validate fields and maintain timestamps', async () => {
      for (const body of [{ status: 'Closed' }, { status: null }, { status: { $ne: null } }, { status: 'Resolved', owner: otherId }, { title: 'Changed' }, []]) {
        assert.equal((await request(`/tickets/${ticketId}`, 'PATCH', body)).status, 400);
      }
      const original = (await request(`/tickets/${ticketId}`)).data.ticket;
      for (const status of ['In Progress', 'Resolved', 'Open']) {
        const result = await request(`/tickets/${ticketId}`, 'PATCH', { status });
        assert.equal(result.status, 200);
        assert.equal(result.data.ticket.status, status);
        assert.equal(result.data.ticket.createdAt, original.createdAt);
        assert.ok(new Date(result.data.ticket.updatedAt) > new Date(original.updatedAt));
      }
    });
    await t.test('invalid IDs, missing tickets, and invalid pagination are handled', async () => {
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        const body = method === 'PATCH' ? { status: 'Open' } : undefined;
        assert.equal((await request('/tickets/not-an-id', method, body)).status, 400);
        assert.equal((await request(`/tickets/${new mongoose.Types.ObjectId()}`, method, body)).status, 404);
      }
      for (const page of ['0', '-1', 'abc', '1.5', '1000000']) assert.equal((await request(`/tickets?page=${page}`)).status, 400);
    });
    await t.test('pagination is bounded, ordered, and isolated by owner', async () => {
      await Ticket.insertMany(Array.from({ length: 21 }, (_, index) => ({ ...valid, title: `Pagination ticket ${index}`, owner: ownerId })));
      await Ticket.create({ ...valid, owner: otherId });
      const first = (await request('/tickets')).data;
      const second = (await request('/tickets?page=2')).data;
      assert.equal(first.tickets.length, 20);
      assert.equal(second.tickets.length, 2);
      assert.equal(first.pagination.total, 22);
      assert.equal(first.pagination.totalPages, 2);
      assert.equal(new Set([...first.tickets, ...second.tickets].map(ticket => ticket.id)).size, 22);
      assert.equal((await request('/tickets', 'GET', undefined, otherCookie)).data.pagination.total, 1);
    });
    await t.test('deletion removes only the owner ticket and subsequent access is 404', async () => {
      assert.equal((await request(`/tickets/${ticketId}`, 'DELETE')).status, 200);
      assert.equal(await Ticket.findById(ticketId), null);
      assert.equal((await request(`/tickets/${ticketId}`)).status, 404);
      assert.equal((await request(`/tickets/${ticketId}`, 'DELETE')).status, 404);
      assert.equal(await Ticket.countDocuments({ owner: otherId }), 1);
    });
    await t.test('revoked session cannot access tickets', async () => {
      assert.equal((await request('/auth/logout', 'POST')).status, 200);
      assert.equal((await request('/tickets')).status, 401);
    });
  } finally {
    assert.equal(mongoose.connection.name, db);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await new Promise(resolve => server.close(resolve));
  }
});
