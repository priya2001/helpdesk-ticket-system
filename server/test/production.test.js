import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';

test('production API accepts frontend-origin auth with Secure host-only cookies and no caching', async () => {
  process.env.NODE_ENV = 'production';
  process.env.APP_ORIGIN = 'https://helpdesk-test.vercel.app';
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  const databaseName = `helpdesk_test_${randomUUID().replaceAll('-', '')}`;
  await connectDatabase(`mongodb://127.0.0.1:27017/${databaseName}`);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { 'Content-Type': 'application/json', Origin: process.env.APP_ORIGIN, 'Sec-Fetch-Site': 'same-origin' };
  try {
    await Promise.all([User.init(), Session.init()]);
    const register = await fetch(`${base}/auth/register`, { method: 'POST', headers, body: JSON.stringify({ name: 'Production Test', email: 'production@example.test', password: 'test-password-only', confirmPassword: 'test-password-only' }) });
    assert.equal(register.status, 201);
    const setCookie = register.headers.get('set-cookie');
    assert.match(setCookie, /; Secure/);
    assert.match(setCookie, /; HttpOnly/);
    assert.match(setCookie, /; SameSite=Lax/);
    assert.ok(!/domain=/i.test(setCookie));
    const cookie = setCookie.split(';')[0];
    const me = await fetch(`${base}/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    assert.equal(me.headers.get('cache-control'), 'no-store');
    const unauthorized = await fetch(`${base}/tickets`);
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get('vercel-cdn-cache-control'), 'no-store');
    const rejected = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { ...headers, Cookie: cookie, Origin: 'https://another-preview.vercel.app' } });
    assert.equal(rejected.status, 403);
    const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { ...headers, Cookie: cookie } });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /; Secure/);
    assert.equal((await fetch(`${base}/auth/me`, { headers: { Cookie: cookie } })).status, 401);
  } finally {
    assert.equal(mongoose.connection.name, databaseName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await new Promise(resolve => server.close(resolve));
  }
});
