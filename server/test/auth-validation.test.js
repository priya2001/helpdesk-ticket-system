import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAuth } from '../src/validation/auth.js';
import { cookieOptions, getAuthConfig } from '../src/config/auth.js';

test('registration validates types, confirmation, and bcrypt byte limits', () => {
  const valid = { name: ' Priya ', email: ' PRIYA@EXAMPLE.COM ', password: 'valid password', confirmPassword: 'valid password' };
  assert.deepEqual(validateAuth(valid, true), { errors: {}, value: { name: 'Priya', email: 'priya@example.com', password: 'valid password' } });
  assert.ok(validateAuth({ ...valid, password: 'é'.repeat(37) }, true).errors.password);
  assert.ok(validateAuth({ ...valid, confirmPassword: 'different' }, true).errors.confirmPassword);
  assert.ok(validateAuth({ email: { $ne: null }, password: ['invalid'] }).errors.email);
  assert.ok(validateAuth(null, true).errors.name);
  assert.ok(validateAuth({ ...valid, password: 'short' }, true).errors.password);
});

test('auth config requires a secret and production cookies are secure', () => {
  const previous = { secret: process.env.JWT_SECRET, env: process.env.NODE_ENV, origin: process.env.APP_ORIGIN };
  try {
    delete process.env.JWT_SECRET;
    assert.throws(getAuthConfig, /JWT_SECRET/);
    process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters';
    process.env.NODE_ENV = 'production';
    process.env.APP_ORIGIN = 'https://helpdesk.example';
    assert.deepEqual(cookieOptions(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  } finally {
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
    if (previous.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.env;
    if (previous.origin === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous.origin;
  }
});
