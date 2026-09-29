import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { getServerConfig } from '../src/config/server.js';
import { getAuthConfig, cookieOptions } from '../src/config/auth.js';

test('local defaults and Render port/host are distinct', () => {
  assert.deepEqual(getServerConfig({}), { port: 4000, host: '127.0.0.1', trustProxy: 0 });
  assert.deepEqual(getServerConfig({ NODE_ENV: 'production', PORT: '10000', TRUST_PROXY_HOPS: '1' }), { port: 10000, host: '0.0.0.0', trustProxy: 1 });
  for (const PORT of ['0', '-1', '65536', '4000abc', '']) assert.throws(() => getServerConfig({ PORT }), /PORT must/);
  for (const TRUST_PROXY_HOPS of ['true', '-1', '6', '1.5']) assert.throws(() => getServerConfig({ TRUST_PROXY_HOPS }), /TRUST_PROXY_HOPS/);
});

test('production origin must be explicit HTTPS and cookie stays host-only', () => {
  const previous = { ...process.env };
  try {
    process.env.JWT_SECRET = 'deployment-test-secret-at-least-32-characters';
    process.env.NODE_ENV = 'production';
    for (const origin of ['', 'http://frontend.example', 'https://frontend.example/', 'https://frontend.example/path', 'https://user:password@frontend.example', 'invalid']) {
      process.env.APP_ORIGIN = origin;
      assert.throws(getAuthConfig, /APP_ORIGIN must/);
    }
    process.env.APP_ORIGIN = 'https://frontend.example';
    assert.equal(getAuthConfig().origin, 'https://frontend.example');
    const options = cookieOptions();
    assert.equal(options.secure, true);
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, 'lax');
    assert.equal(options.domain, undefined);
  } finally {
    for (const key of ['JWT_SECRET', 'NODE_ENV', 'APP_ORIGIN']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test('one trusted hop does not use attacker-supplied leftmost forwarded IP', async () => {
  const app = express();
  app.set('trust proxy', getServerConfig({ TRUST_PROXY_HOPS: '1' }).trustProxy);
  app.get('/', (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, { headers: { 'X-Forwarded-For': '198.51.100.99, 203.0.113.10' } });
    assert.equal((await response.json()).ip, '203.0.113.10');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
