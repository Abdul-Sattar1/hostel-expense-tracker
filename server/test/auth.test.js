import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { SECRET, startApp } from './setup.js';

const USER = { name: 'Ayesha Khan', email: 'ayesha@example.com', password: 'Hostel2026' };
let app;
let userId;
let cookie;

before(async () => { app = await startApp(); });
after(() => app.stop());
beforeEach(() => { app.control.db = 'connected'; });

describe('health', () => {
  test('reports ok with a connected database', async () => {
    const res = await app.request('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual([res.json.status, res.json.database], ['ok', 'connected']);
  });
});

describe('registration', () => {
  test('creates an account, sets an HttpOnly cookie and returns a safe user', async () => {
    const res = await app.request('POST', '/api/auth/register', { body: USER });
    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.json.user).sort(), ['avatarUpdatedAt', 'createdAt', 'email', 'googleLinked', 'hasPassword', 'id', 'name', 'pendingEmail', 'preferences']);
    assert.equal(res.json.user.email, USER.email);
    assert.doesNotMatch(res.text, /passwordHash|\$2[aby]\$/i);
    const raw = res.setCookie.find((c) => c.startsWith('token='));
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /SameSite=Lax/i);
    assert.match(raw, /Max-Age=604800/);
    userId = res.json.user.id;
  });

  test('stores a bcrypt hash, never the plaintext password', async () => {
    const doc = [...app.users.values()].find((u) => u.email === USER.email);
    assert.match(doc.passwordHash, /^\$2[aby]\$\d\d\$/);
    assert.notEqual(doc.passwordHash, USER.password);
    assert.ok(!JSON.stringify(doc).includes(USER.password));
  });

  test('rejects a duplicate email, including different letter case', async () => {
    const res = await app.request('POST', '/api/auth/register', { body: { ...USER, email: '  AYESHA@Example.com ' } });
    assert.equal(res.status, 409);
    assert.equal(app.users.size, 1);
  });

  const invalid = {
    'missing fields': {},
    'short name': { ...USER, name: 'A' },
    'bad email': { ...USER, email: 'not-an-email' },
    'short password': { ...USER, email: 'a@b.co', password: 'abc1' },
    'password without a number': { ...USER, email: 'a@b.co', password: 'onlyletters' },
    'password without a letter': { ...USER, email: 'a@b.co', password: '1234567890' },
    'non-string values': { name: 123, email: ['x'], password: { a: 1 } },
  };
  for (const [label, body] of Object.entries(invalid)) {
    test(`rejects ${label} with field errors`, async () => {
      const res = await app.request('POST', '/api/auth/register', { body });
      assert.equal(res.status, 400);
      assert.ok(Object.keys(res.json.errors).length > 0);
    });
  }

  test('ignores client-supplied extra fields such as role or id', async () => {
    const res = await app.request('POST', '/api/auth/register', { body: { name: 'Bilal Raza', email: 'bilal@example.com', password: 'Hostel2026', role: 'admin', _id: '000000000000000000000000' } });
    assert.equal(res.status, 201);
    const doc = [...app.users.values()].find((u) => u.email === 'bilal@example.com');
    assert.equal(doc.role, undefined);
    assert.notEqual(String(doc._id), '000000000000000000000000');
  });
});

describe('login', () => {
  test('succeeds with correct credentials (email is case-insensitive)', async () => {
    const res = await app.request('POST', '/api/auth/login', { body: { email: 'AYESHA@example.com', password: USER.password } });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.id, userId);
    assert.doesNotMatch(res.text, /passwordHash|\$2[aby]\$/);
    assert.ok(res.cookie);
    cookie = res.cookie;
  });

  test('gives the same generic error for a wrong password and an unknown email', async () => {
    const wrong = await app.request('POST', '/api/auth/login', { body: { email: USER.email, password: 'Wrong-pass1' } });
    const unknown = await app.request('POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: 'Wrong-pass1' } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.json, unknown.json);
    assert.equal(wrong.cookie, undefined);
  });

  test('rejects missing or non-string input', async () => {
    assert.equal((await app.request('POST', '/api/auth/login', { body: {} })).status, 400);
    assert.equal((await app.request('POST', '/api/auth/login', { body: { email: { $ne: '' }, password: { $ne: '' } } })).status, 400);
  });
});

describe('authentication middleware and /api/auth/me', () => {
  test('returns the current user for a valid cookie', async () => {
    const res = await app.request('GET', '/api/auth/me', { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.email, USER.email);
    assert.equal(res.json.user.passwordHash, undefined);
  });

  test('rejects a missing token', async () => {
    assert.equal((await app.request('GET', '/api/auth/me')).status, 401);
  });

  const bad = {
    'malformed token': () => 'token=garbage',
    'expired token': () => `token=${jwt.sign({}, SECRET, { subject: userId, expiresIn: -10 })}`,
    'token signed with another secret': () => `token=${jwt.sign({}, 'another-secret'.padEnd(40, 'y'), { subject: userId })}`,
    'unsigned (alg none) token': () => `token=${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(`{"sub":"${userId}"}`).toString('base64url')}.`,
    'valid token for a user that no longer exists': () => `token=${jwt.sign({}, SECRET, { subject: '000000000000000000000000' })}`,
    'valid token with a non-ObjectId subject': () => `token=${jwt.sign({}, SECRET, { subject: 'abc' })}`,
  };
  for (const [label, make] of Object.entries(bad)) {
    test(`rejects ${label}`, async () => {
      const res = await app.request('GET', '/api/auth/me', { cookie: make() });
      assert.equal(res.status, 401);
      assert.deepEqual(Object.keys(res.json), ['message']);
    });
  }
});

describe('logout, CSRF and safe errors', () => {
  test('logout clears the cookie', async () => {
    const res = await app.request('POST', '/api/auth/logout', { cookie });
    assert.equal(res.status, 200);
    const raw = res.setCookie.find((c) => c.startsWith('token='));
    assert.match(raw, /^token=;/);
    assert.match(raw, /Expires=Thu, 01 Jan 1970/);
    assert.equal((await app.request('GET', '/api/auth/me')).status, 401);
  });

  test('blocks state-changing requests from an untrusted Origin', async () => {
    const res = await app.request('POST', '/api/auth/login', { body: { email: USER.email, password: USER.password }, headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
    assert.equal(res.cookie, undefined);
  });

  test('allows the configured front-end origin', async () => {
    const res = await app.request('POST', '/api/auth/login', { body: { email: USER.email, password: USER.password }, headers: { Origin: 'http://localhost:5173' } });
    assert.equal(res.status, 200);
  });

  test('malformed JSON and unknown routes give safe JSON errors without stack traces', async () => {
    const bad = await app.request('POST', '/api/auth/login', { body: '{"email":' });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.message, 'Malformed JSON body.');
    const missing = await app.request('GET', '/api/nope');
    assert.equal(missing.status, 404);
    for (const r of [bad, missing]) assert.doesNotMatch(r.text, /at .*\(|node_modules|stack/i);
  });

  test('auth responses are not cacheable', async () => {
    const res = await app.request('GET', '/api/auth/me');
    assert.equal(res.cacheControl, 'no-store');
  });
});

describe('database unavailable', () => {
  test('database-dependent endpoints return 503 and health reports degraded', async () => {
    app.control.db = 'disconnected';
    const login = await app.request('POST', '/api/auth/login', { body: { email: USER.email, password: USER.password } });
    const me = await app.request('GET', '/api/auth/me', { cookie });
    const health = await app.request('GET', '/api/health');
    assert.deepEqual([login.status, me.status, health.status], [503, 503, 503]);
    assert.equal(health.json.status, 'degraded');
    assert.doesNotMatch(login.text, /mongo|127\.0\.0\.1/i);
    app.control.db = 'connected';
    assert.equal((await app.request('GET', '/api/health')).status, 200);
  });
});
