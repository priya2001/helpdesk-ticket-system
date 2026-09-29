import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from '../src/api.js';

test('API requests use same-origin cookies and a request timeout', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/tickets');
    assert.equal(options.credentials, 'same-origin');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers['Content-Type'], 'application/json');
    return Response.json({ tickets: [] });
  });
  assert.deepEqual(await api('/tickets'), { tickets: [] });
});

test('API errors retain status and field validation messages', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Please check the form.', errors: { title: 'Title required.' } }, { status: 400 }));
  await assert.rejects(api('/tickets'), error => {
    assert.equal(error.status, 400);
    assert.equal(error.fields.title, 'Title required.');
    assert.equal(error.message, 'Please check the form.');
    return true;
  });
});

test('network failures give a readable error', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(api('/tickets'), /Unable to reach the server/);
});

test('HTML returned with status 200 must not be treated as a successful API result', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Proxy fallback</html>', { status: 200 }));
  await assert.rejects(api('/tickets'), /unreadable response/);
});

test('non-JSON error responses retain HTTP status for session expiry handling', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Unauthorized', { status: 401 }));
  await assert.rejects(api('/auth/me'), error => error.status === 401);
});

test('null and array JSON payloads cannot silently break page state', async t => {
  for (const value of [null, [], 'invalid']) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(value));
    await assert.rejects(api('/tickets'), /unreadable response/);
    mock.mock.restore();
  }
});
