import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';

test('authentication API security and lifecycle', async t => {
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.APP_ORIGIN = 'http://127.0.0.1:5173';
  process.env.NODE_ENV = 'test';
  const databaseName = `helpdesk_test_${randomUUID().replaceAll('-', '')}`;
  await connectDatabase(`mongodb://127.0.0.1:27017/${databaseName}`);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
  const account = { name: 'Test User', email: 'AUTH@example.com', password: 'Test password 123!', confirmPassword: 'Test password 123!', role: 'admin' };
  let cookie;
  let userId;
  async function request(path, { body, cookie: sessionCookie, origin = process.env.APP_ORIGIN, method = body ? 'POST' : 'GET' } = {}) {
    const response = await fetch(baseUrl + path, {
      method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  try {
    await Promise.all([User.init(), Session.init()]);
    await t.test('anonymous and cross-origin requests are rejected', async () => {
      assert.equal((await request('/me')).status, 401);
      assert.equal((await request('/register', { body: account, origin: 'https://attacker.example' })).status, 403);
      assert.equal(await User.countDocuments(), 0);
    });
    await t.test('invalid registration and injection-shaped input are rejected', async () => {
      const invalid = await request('/register', { body: { ...account, password: 'short', confirmPassword: 'different' } });
      assert.equal(invalid.status, 400);
      assert.ok(invalid.data.errors.password);
      assert.ok(invalid.data.errors.confirmPassword);
      assert.equal((await request('/login', { body: { email: { $ne: null }, password: 'bad' } })).status, 400);
    });
    await t.test('registration hashes passwords, ignores admin injection, and creates a secure cookie', async () => {
      const result = await request('/register', { body: account });
      assert.equal(result.status, 201);
      assert.equal(result.data.user.role, 'user');
      assert.equal(result.data.user.email, 'auth@example.com');
      assert.equal(Object.hasOwn(result.data.user, 'passwordHash'), false);
      userId = result.data.user.id;
      const header = result.headers.get('set-cookie');
      assert.match(header, /HttpOnly/);
      assert.match(header, /SameSite=Lax/);
      assert.match(header, /Max-Age=604800/);
      cookie = header.split(';')[0];
      const user = await User.findById(userId).select('+passwordHash');
      assert.notEqual(user.passwordHash, account.password);
      assert.ok(await bcrypt.compare(account.password, user.passwordHash));
      assert.equal((await request('/me', { cookie })).data.user.id, userId);
    });
    await t.test('normalized duplicate email is rejected', async () => {
      assert.equal((await request('/register', { body: { ...account, email: ' auth@EXAMPLE.com ' } })).status, 409);
      assert.equal(await User.countDocuments(), 1);
    });
    await t.test('logout clears the cookie and revokes the previous token', async () => {
      const result = await request('/logout', { cookie, method: 'POST' });
      assert.equal(result.status, 200);
      assert.match(result.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
      assert.equal((await request('/me', { cookie })).status, 401);
      assert.equal((await request('/logout', { method: 'POST' })).status, 200);
    });
    await t.test('incorrect and unknown credentials return the same response', async () => {
      const wrong = await request('/login', { body: { email: account.email, password: 'wrong password' } });
      const missing = await request('/login', { body: { email: 'missing@example.com', password: 'wrong password' } });
      assert.equal(wrong.status, 401);
      assert.equal(missing.status, 401);
      assert.deepEqual(wrong.data, missing.data);
    });
    await t.test('login persists across requests and rejects tampered or expired sessions', async () => {
      const result = await request('/login', { body: { email: account.email, password: account.password } });
      assert.equal(result.status, 200);
      cookie = result.headers.get('set-cookie').split(';')[0];
      assert.equal((await request('/me', { cookie })).status, 200);
      assert.equal((await request('/me', { cookie: cookie + 'tampered' })).status, 401);
      const payload = jwt.decode(cookie.slice(cookie.indexOf('=') + 1));
      const expired = jwt.sign({}, process.env.JWT_SECRET, { subject: userId, jwtid: payload.jti, expiresIn: -1, issuer: 'helpdesk', audience: 'helpdesk-web' });
      assert.equal((await request('/me', { cookie: `helpdesk_session=${expired}` })).status, 401);
      await Session.updateOne({ _id: payload.jti }, { expiresAt: new Date(0) });
      assert.equal((await request('/me', { cookie })).status, 401);
    });
    await t.test('re-login rotates a browser session and deleted users cannot authenticate', async () => {
      const login = () => request('/login', { body: { email: account.email, password: account.password }, cookie });
      cookie = (await login()).headers.get('set-cookie').split(';')[0];
      const oldCookie = cookie;
      cookie = (await login()).headers.get('set-cookie').split(';')[0];
      assert.equal((await request('/me', { cookie: oldCookie })).status, 401);
      await User.deleteOne({ _id: userId });
      assert.equal((await request('/me', { cookie })).status, 401);
    });
    await t.test('repeated auth requests trigger the rate limit', async () => {
      let result;
      for (let i = 0; i < 21; i++) {
        result = await request('/login', { body: {} });
        if (result.status === 429) break;
      }
      assert.equal(result.status, 429);
      assert.ok(result.headers.has('retry-after'));
    });
  } finally {
    assert.equal(mongoose.connection.name, databaseName);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await new Promise(resolve => server.close(resolve));
  }
});
