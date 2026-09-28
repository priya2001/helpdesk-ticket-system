import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { Ticket } from '../src/models/Ticket.js';

test('database persists records, enforces email uniqueness, and reports readiness', async () => {
  // Never load the app .env or use its database. Only this generated test DB is removed.
  const databaseName = `helpdesk_test_${randomUUID().replaceAll('-', '')}`;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let connected = false;

  try {
    assert.equal((await fetch(`${baseUrl}/api/ready`)).status, 503);
    await connectDatabase(`mongodb://127.0.0.1:27017/${databaseName}`);
    connected = true;
    await Promise.all([User.init(), Ticket.init()]);
    const ready = await fetch(`${baseUrl}/api/ready`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: 'ok', database: 'connected' });

    const user = await User.create({ name: 'Test User', email: 'TEST@example.com', passwordHash: '$2b$12$' + 'a'.repeat(53) });
    await assert.rejects(User.create({ name: 'Duplicate', email: 'test@example.com', passwordHash: '$2b$12$' + 'b'.repeat(53) }), { code: 11000 });
    assert.equal((await User.findById(user.id)).passwordHash, undefined);

    const ticket = await Ticket.create({ title: 'Test ticket', description: 'Testing database persistence.', category: 'Technical', owner: user._id });
    const saved = await Ticket.findById(ticket.id).populate('owner');
    assert.equal(saved.owner.email, 'test@example.com');
    assert.ok(saved.createdAt instanceof Date);
    const before = saved.updatedAt;
    saved.status = 'In Progress';
    await saved.save();
    assert.ok(saved.updatedAt > before);
    assert.equal((await Ticket.findById(ticket.id)).status, 'In Progress');
  } finally {
    if (connected) {
      assert.equal(mongoose.connection.name, databaseName);
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    await new Promise(resolve => server.close(resolve));
  }
});

test('missing and unreachable database configuration fails without exposing credentials', async () => {
  await assert.rejects(connectDatabase(''), /Set a valid MONGODB_URI/);
  await assert.rejects(connectDatabase('mongodb://test:privatepassword@127.0.0.1:1/test'), error => {
    assert.match(error.message, /MongoDB connection failed/);
    assert.ok(!error.message.includes('privatepassword'));
    return true;
  });
  await mongoose.disconnect();
});
