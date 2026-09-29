import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { configureVercel, validateBackendOrigin } from './configure-vercel.mjs';

test('Vercel configuration keeps API proxy before SPA fallback and preserves build settings', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  const result = configureVercel(config, 'https://helpdesk-qa.onrender.com/');
  assert.deepEqual(result.rewrites[0], { source: '/api/:path*', destination: 'https://helpdesk-qa.onrender.com/api/:path*' });
  assert.deepEqual(result.rewrites[1], { source: '/(.*)', destination: '/index.html' });
  assert.equal(result.outputDirectory, 'client/dist');
  assert.equal(result.installCommand, 'npm ci --include=dev');
  assert.equal(result.buildCommand, 'npm run build:vercel');
  assert.ok(result.headers[0].headers.some(header => header.key === 'Cache-Control' && header.value === 'no-store'));
  assert.notEqual(result, config);
});

test('backend URL setup rejects placeholders, credentials and non-origin URLs', () => {
  for (const value of ['bad', 'http://api.example.com', 'https://replace-with-render-url.invalid', 'https://user:secret@api.example.com', 'https://api.example.com/api', 'https://api.example.com?key=secret', 'https://api.example.com/#fragment']) {
    assert.throws(() => validateBackendOrigin(value));
  }
  assert.equal(validateBackendOrigin('https://api.example.com'), 'https://api.example.com');
});
