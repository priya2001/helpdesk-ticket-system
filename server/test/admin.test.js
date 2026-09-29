import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { Ticket } from '../src/models/Ticket.js';
import { Session } from '../src/models/Session.js';

const exec = promisify(execFile);
test('admin authorization, filtering, statistics, updates, and promotion command', async t => {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.APP_ORIGIN = 'http://127.0.0.1:5173';
  const db = `helpdesk_test_${randomUUID().replaceAll('-', '')}`;
  const uri = `mongodb://127.0.0.1:27017/${db}`;
  await connectDatabase(uri);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let admin, alice, bob, adminCookie, userCookie, tickets;
  const script = fileURLToPath(new URL('../scripts/make-admin.js', import.meta.url));
  async function request(path, method = 'GET', body, cookie = adminCookie, origin = process.env.APP_ORIGIN) {
    const response = await fetch(base + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  async function tokenFor(user) {
    const jti = randomUUID();
    await Session.create({ _id: jti, user: user._id, expiresAt: new Date(Date.now() + 60000) });
    // An injected JWT role must never grant access; role comes from the database.
    return 'helpdesk_session=' + jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { subject: user.id, jwtid: jti, issuer: 'helpdesk', audience: 'helpdesk-web', expiresIn: 60 });
  }
  try {
    await Promise.all([User.init(), Ticket.init(), Session.init()]);
    [admin, alice, bob] = await User.create(['admin', 'alice', 'bob'].map(name => ({ name, email: `${name}@example.test`, passwordHash: '$2b$12$' + 'a'.repeat(53) })));
    adminCookie = await tokenFor(admin);
    userCookie = await tokenFor(alice);
    await t.test('anonymous and normal users cannot access admin APIs', async () => {
      for (const [cookie, expected] of [[null, 401], [userCookie, 403], [adminCookie, 403]]) {
        assert.equal((await request('/admin/tickets', 'GET', undefined, cookie)).status, expected);
        assert.equal((await request(`/admin/tickets/${new mongoose.Types.ObjectId()}`, 'PATCH', { status: 'Resolved' }, cookie)).status, expected);
      }
    });
    await t.test('CLI promotes only a specified existing account and is repeatable', async () => {
      for (let i = 0; i < 2; i++) {
        const result = await exec(process.execPath, [script, ' ADMIN@EXAMPLE.TEST '], { env: { ...process.env, MONGODB_URI: uri } });
        assert.match(result.stdout, /Admin access enabled/);
      }
      assert.equal((await User.findById(admin.id)).role, 'admin');
      assert.equal((await User.findById(alice.id)).role, 'user');
      await assert.rejects(exec(process.execPath, [script, 'missing@example.test'], { env: { ...process.env, MONGODB_URI: uri } }), error => /No registered account/.test(error.stderr));
      await assert.rejects(exec(process.execPath, [script, 'bad-email'], { env: { ...process.env, MONGODB_URI: uri } }), error => /Usage:/.test(error.stderr));
      assert.equal(await User.countDocuments(), 3);
      const result = await request('/admin/tickets');
      assert.equal(result.status, 200);
      assert.deepEqual(result.data.statistics, { total: 0, open: 0, inProgress: 0, resolved: 0 });
    });
    await t.test('admin lists all owners with accurate global counts', async () => {
      tickets = await Ticket.create([
        { title: 'Wi-Fi [urgent]', description: 'Connection drops frequently.', category: 'Technical', priority: 'High', status: 'Open', owner: alice._id },
        { title: 'Billing question', description: 'Need help with my invoice.', category: 'Billing', priority: 'Medium', status: 'In Progress', owner: bob._id },
        { title: 'Wi-Fi setup', description: 'Device connected successfully.', category: 'Technical', priority: 'Low', status: 'Resolved', owner: bob._id },
      ]);
      const { data } = await request('/admin/tickets');
      assert.equal(data.tickets.length, 3);
      assert.deepEqual(data.statistics, { total: 3, open: 1, inProgress: 1, resolved: 1 });
      assert.deepEqual(new Set(data.tickets.map(ticket => ticket.owner.email)), new Set(['alice@example.test', 'bob@example.test']));
      assert.ok(!JSON.stringify(data).includes('passwordHash'));
      assert.equal((await request('/tickets')).data.tickets.length, 0);
    });
    await t.test('filters combine and search treats regex syntax literally', async () => {
      const combined = (await request('/admin/tickets?status=Open&priority=High&search=wi-fi')).data;
      assert.equal(combined.tickets.length, 1);
      assert.equal(combined.tickets[0].id, tickets[0].id);
      assert.equal(combined.statistics.total, 3);
      assert.equal((await request('/admin/tickets?search=%5Burgent%5D')).data.tickets.length, 1);
      assert.equal((await request('/admin/tickets?search=.*')).data.tickets.length, 0);
      assert.equal((await request('/admin/tickets?priority=High&status=Resolved')).data.tickets.length, 0);
      for (const query of ['status=bad', 'priority=Urgent', 'page=0', 'page=1000000', 'search=a&search=b', 'search=' + 'x'.repeat(151)]) assert.equal((await request('/admin/tickets?' + query)).status, 400);
    });
    await t.test('admin updates any ticket status, and owner sees the change', async () => {
      const result = await request(`/admin/tickets/${tickets[0].id}`, 'PATCH', { status: 'Resolved' });
      assert.equal(result.status, 200);
      assert.equal(result.data.ticket.status, 'Resolved');
      assert.equal(result.data.ticket.createdAt, tickets[0].createdAt.toISOString());
      assert.ok(new Date(result.data.ticket.updatedAt) > tickets[0].updatedAt);
      assert.equal((await request(`/tickets/${tickets[0].id}`, 'GET', undefined, userCookie)).data.ticket.status, 'Resolved');
      assert.deepEqual((await request('/admin/tickets')).data.statistics, { total: 3, open: 0, inProgress: 1, resolved: 2 });
      for (const body of [{ status: 'Closed' }, { status: null }, { status: 'Open', owner: admin.id }]) assert.equal((await request(`/admin/tickets/${tickets[0].id}`, 'PATCH', body)).status, 400);
      assert.equal((await request('/admin/tickets/invalid', 'PATCH', { status: 'Open' })).status, 400);
      assert.equal((await request(`/admin/tickets/${new mongoose.Types.ObjectId()}`, 'PATCH', { status: 'Open' })).status, 404);
      assert.equal((await request(`/admin/tickets/${tickets[0].id}`, 'PATCH', { status: 'Open' }, adminCookie, 'https://bad.example')).status, 403);
    });
    await t.test('pagination is bounded and missing owners are handled', async () => {
      await Ticket.insertMany(Array.from({ length: 20 }, (_, i) => ({ title: `Extra ticket ${i}`, description: 'Pagination testing request.', category: 'Other', owner: alice._id })));
      const first = (await request('/admin/tickets')).data;
      const second = (await request('/admin/tickets?page=2')).data;
      assert.equal(first.tickets.length, 20);
      assert.equal(second.tickets.length, 3);
      assert.equal(first.pagination.total, 23);
      assert.equal(new Set([...first.tickets, ...second.tickets].map(ticket => ticket.id)).size, 23);
      await User.deleteOne({ _id: bob._id });
      assert.equal((await request('/admin/tickets?search=Billing')).data.tickets[0].owner, null);
    });
    await t.test('role revocation is enforced immediately for existing JWTs', async () => {
      await User.updateOne({ _id: admin._id }, { role: 'user' });
      assert.equal((await request('/admin/tickets')).status, 403);
      assert.equal((await request(`/admin/tickets/${tickets[0].id}`, 'PATCH', { status: 'Open' })).status, 403);
    });
  } finally {
    assert.equal(mongoose.connection.name, db);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await new Promise(resolve => server.close(resolve));
  }
});
