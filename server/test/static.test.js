import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

// Production serving of the built client (run `npm run build` first; skipped when client/dist is absent).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist/index.html');
let server;
let base;

before(async () => {
  if (!fs.existsSync(dist)) return;
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'x'.repeat(40);
  delete process.env.MONGODB_URI;
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server?.close());

const opts = { skip: !fs.existsSync(dist) && 'client/dist is not built' };

test('React routes get index.html so deep links and refreshes work', opts, async () => {
  for (const p of ['/', '/app/settings?section=security', '/reset-password?token=x', '/some/unknown/page']) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get('content-type'), /text\/html/);
  }
});

test('a missing static file is a 404, never HTML', opts, async () => {
  const res = await fetch(`${base}/assets/does-not-exist.js`);
  assert.equal(res.status, 404);
  assert.doesNotMatch(res.headers.get('content-type'), /html/);
});

test('API errors are JSON, not the frontend page', opts, async () => {
  for (const [method, p] of [['GET', '/api/nothing'], ['POST', '/api/nothing'], ['GET', '/api/transactions']]) {
    const res = await fetch(base + p, { method });
    assert.match(res.headers.get('content-type'), /application\/json/, p);
    assert.ok([404, 503].includes(res.status), p);
  }
});

test('security headers allow only Google sign-in and local images', opts, async () => {
  const csp = (await fetch(base)).headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(csp, /img-src 'self' data: blob:/);
  assert.match(csp, /object-src 'none'/);
});
