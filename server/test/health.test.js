import { test } from 'node:test';
import assert from 'node:assert/strict';

// No MONGODB_URI here: the app must still start, report that honestly, and refuse DB-backed routes.
test('without a database: health is ok/not-configured, auth routes return 503, unknown API route 404', async () => {
  delete process.env.MONGODB_URI;
  const { createApp } = await import('../src/app.js');
  const server = createApp().listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    const body = await health.json();
    assert.deepEqual([body.status, body.database], ['ok', 'not-configured']);
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"a@b.co","password":"x"}' });
    assert.equal(login.status, 503);
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  } finally {
    server.close();
  }
});
