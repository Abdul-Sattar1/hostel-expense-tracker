import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './setup.js';

let app;
before(async () => { app = await startApp({ authRateLimit: 3 }); });
after(() => app.stop());

test('login is rate limited after repeated failures, with a generic message', async () => {
  const attempt = () => app.request('POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: 'Wrong-pass1' } });
  for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
  const blocked = await attempt();
  assert.equal(blocked.status, 429);
  assert.match(blocked.json.message, /too many/i);
});

test('forgot-password, reset-password and Google sign-in are rate limited too', async () => {
  const paths = { '/api/auth/forgot-password': { email: 'a@example.com' }, '/api/auth/reset-password': { token: 'x', password: 'Hostel2026' } };
  for (const [path, body] of Object.entries(paths)) {
    for (let i = 0; i < 3; i++) assert.notEqual((await app.request('POST', path, { body })).status, 429);
    assert.equal((await app.request('POST', path, { body })).status, 429, path);
  }
  const google = () => app.request('POST', '/api/auth/google', { body: { credential: 'bad' } });
  for (let i = 0; i < 3; i++) assert.equal((await google()).status, 401);
  assert.equal((await google()).status, 429);
});

test('the public contact form is rate limited per client', async () => {
  const body = { name: 'Ayesha Khan', email: 'a@example.com', message: 'Please add a dark chart for spending.' };
  const send = () => app.request('POST', '/api/contact', { body });
  for (let i = 0; i < 3; i++) assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 429);
});

test('registration has its own limit', async () => {
  const register = (n) => app.request('POST', '/api/auth/register', { body: { name: 'Test User', email: `u${n}@example.com`, password: 'Hostel2026' } });
  for (let i = 0; i < 3; i++) assert.equal((await register(i)).status, 201);
  assert.equal((await register(9)).status, 429);
});
