import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Ticket } from '../src/models/Ticket.js';

// Format-only fixture; it is not a real login credential.
const passwordHash = '$2b$12$' + 'a'.repeat(53);
const ticketData = {
  title: 'Cannot sign in', description: 'Sign-in fails after entering my email.',
  category: 'Account', owner: new mongoose.Types.ObjectId(),
};

test('users normalize email, default to user, and never serialize password hashes', async () => {
  const user = new User({ name: ' Priya ', email: ' PRIYA@EXAMPLE.COM ', passwordHash });
  await user.validate();
  assert.equal(user.name, 'Priya');
  assert.equal(user.email, 'priya@example.com');
  assert.equal(user.role, 'user');
  assert.equal(Object.hasOwn(user.toJSON(), 'passwordHash'), false);
});

test('users reject missing fields, invalid email, plaintext hashes, and invalid roles', async () => {
  await assert.rejects(new User().validate(), error => Boolean(error.errors.name));
  const invalid = new User({ name: 'A', email: 'bad-email', passwordHash: 'plaintext', role: 'superadmin' });
  await assert.rejects(invalid.validate(), error => {
    for (const field of ['name', 'email', 'passwordHash', 'role']) assert.ok(error.errors[field], field);
    return true;
  });
});

test('tickets require an owner and reject invalid values and blank content', async () => {
  const ticket = new Ticket(ticketData);
  await ticket.validate();
  assert.equal(ticket.status, 'Open');
  assert.equal(ticket.priority, 'Medium');
  const invalid = new Ticket({ title: '  ', description: 'short', category: 'Unknown', status: 'Done', priority: 'Urgent' });
  await assert.rejects(invalid.validate(), error => {
    for (const field of ['owner', 'title', 'description', 'category', 'status', 'priority']) assert.ok(error.errors[field], field);
    return true;
  });
  await assert.rejects(new Ticket({ ...ticketData, title: 'x'.repeat(151) }).validate(), error => Boolean(error.errors.title));
  await assert.rejects(new Ticket({ ...ticketData, status: null, priority: null }).validate(), error => Boolean(error.errors.status && error.errors.priority));
});
