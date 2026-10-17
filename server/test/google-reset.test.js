import crypto from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './setup.js';

let app;
const ALICE = { name: 'Alice Khan', email: 'alice@example.com', password: 'Hostel2026' };
const GOOGLE = { id: 'google-sub-1', email: 'gina@example.com', emailVerified: true, name: 'Gina Google' };
const post = (path, body) => app.request('POST', `/api/auth${path}`, { body });
const tokenFrom = (mail) => new URL(mail.link).searchParams.get('token');
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const userByEmail = (email) => [...app.users.values()].find((u) => u.email === email);

before(async () => { app = await startApp(); });
after(() => app.stop());
beforeEach(() => {
  app.control.db = 'connected';
  app.control.mails.length = 0;
  app.control.google = () => GOOGLE;
  app.users.clear();
});

describe('continue with Google', () => {
  test('creates a password-less account and sets the same HttpOnly session cookie', async () => {
    const res = await post('/google', { credential: 'valid-token' });
    assert.equal(res.status, 200);
    assert.deepEqual([res.json.user.email, res.json.user.name], [GOOGLE.email, GOOGLE.name]);
    assert.match(res.setCookie.find((c) => c.startsWith('token=')), /HttpOnly.*SameSite=Lax|SameSite=Lax.*HttpOnly/i);
    const me = await app.request('GET', '/api/auth/me', { cookie: res.cookie });
    assert.equal(me.json.user.email, GOOGLE.email);
    assert.equal(userByEmail(GOOGLE.email).passwordHash, undefined);
  });

  test('a returning Google user is found by Google id, not duplicated', async () => {
    await post('/google', { credential: 'a' });
    const res = await post('/google', { credential: 'b' });
    assert.equal(res.status, 200);
    assert.equal(app.users.size, 1);
  });

  test('rejects a token Google does not verify', async () => {
    app.control.google = () => { throw new Error('Wrong recipient, payload audience != requiredAudience'); };
    const res = await post('/google', { credential: 'forged' });
    assert.equal(res.status, 401);
    assert.doesNotMatch(res.text, /audience|recipient/i);
    assert.equal(app.users.size, 0);
    assert.equal(res.cookie, undefined);
  });

  test('rejects an unverified Google email', async () => {
    app.control.google = () => ({ ...GOOGLE, emailVerified: false });
    assert.equal((await post('/google', { credential: 'x' })).status, 401);
    assert.equal(app.users.size, 0);
  });

  test('rejects a missing or non-string credential without calling Google', async () => {
    let called = false;
    app.control.google = () => { called = true; return GOOGLE; };
    assert.equal((await post('/google', {})).status, 400);
    assert.equal((await post('/google', { credential: { a: 1 } })).status, 400);
    assert.equal(called, false);
  });

  test('does not link to an existing password account with the same email', async () => {
    await post('/register', { ...ALICE });
    app.control.google = () => ({ ...GOOGLE, email: ALICE.email });
    const res = await post('/google', { credential: 'x' });
    assert.equal(res.status, 409);
    assert.equal(res.cookie, undefined);
    assert.equal(app.users.size, 1);
    assert.equal(userByEmail(ALICE.email).googleId, undefined);
  });

  test('a Google-only account cannot be entered with a password, including the dummy hash password', async () => {
    await post('/google', { credential: 'x' });
    for (const password of ['Hostel2026', 'not-a-real-password']) {
      assert.equal((await post('/login', { email: GOOGLE.email, password })).status, 401);
    }
  });

  test('email/password registration and login still work', async () => {
    assert.equal((await post('/register', ALICE)).status, 201);
    const res = await post('/login', { email: ALICE.email, password: ALICE.password });
    assert.equal(res.status, 200);
    assert.equal((await post('/login', { email: ALICE.email, password: 'Wrong-pass1' })).status, 401);
  });

  test('/config exposes only the public client id', async () => {
    const res = await app.request('GET', '/api/auth/config');
    assert.deepEqual(Object.keys(res.json), ['googleClientId']);
  });
});

describe('forgot password', () => {
  test('sends a link for a password account and stores only the token hash', async () => {
    await post('/register', ALICE);
    const res = await post('/forgot-password', { email: ALICE.email.toUpperCase() });
    assert.equal(res.status, 200);
    assert.equal(app.control.mails.length, 1);
    const token = tokenFrom(app.control.mails[0]);
    assert.match(token, /^[a-f0-9]{64}$/);
    const rec = userByEmail(ALICE.email);
    assert.equal(rec.resetTokenHash, sha256(token));
    assert.ok(!JSON.stringify(rec).includes(token));
    const minutes = (rec.resetTokenExpires - Date.now()) / 60000;
    assert.ok(minutes > 19 && minutes <= 20, `expires in ${minutes} minutes`);
  });

  test('gives the same response for unknown and Google-only accounts and sends nothing', async () => {
    await post('/google', { credential: 'x' });
    const known = await post('/forgot-password', { email: 'nobody@example.com' });
    const googleOnly = await post('/forgot-password', { email: GOOGLE.email });
    assert.equal(known.status, 200);
    assert.deepEqual(googleOnly.json, known.json);
    assert.equal(app.control.mails.length, 0);
    assert.equal(userByEmail(GOOGLE.email).passwordHash, undefined);
  });

  test('rejects a malformed email', async () => {
    assert.equal((await post('/forgot-password', { email: 'nope' })).status, 400);
  });
});

describe('reset password', () => {
  const NEW = 'Brand-new-2026';
  const request = async () => {
    await post('/register', ALICE);
    await post('/forgot-password', { email: ALICE.email });
    return tokenFrom(app.control.mails.at(-1));
  };

  test('sets a new bcrypt-hashed password; old one stops working', async () => {
    const token = await request();
    const res = await post('/reset-password', { token, password: NEW });
    assert.equal(res.status, 200);
    assert.equal(res.cookie, undefined);
    const rec = userByEmail(ALICE.email);
    assert.match(rec.passwordHash, /^\$2[aby]\$\d\d\$/);
    assert.notEqual(rec.passwordHash, NEW);
    assert.equal(rec.resetTokenHash, undefined);
    assert.equal((await post('/login', { email: ALICE.email, password: ALICE.password })).status, 401);
    assert.equal((await post('/login', { email: ALICE.email, password: NEW })).status, 200);
  });

  test('a token works only once', async () => {
    const token = await request();
    assert.equal((await post('/reset-password', { token, password: NEW })).status, 200);
    assert.equal((await post('/reset-password', { token, password: 'Another-pass-1' })).status, 400);
    assert.equal((await post('/login', { email: ALICE.email, password: NEW })).status, 200);
  });

  test('an expired token is rejected and the password is unchanged', async () => {
    const token = await request();
    userByEmail(ALICE.email).resetTokenExpires = new Date(Date.now() - 1000);
    assert.equal((await post('/reset-password', { token, password: NEW })).status, 400);
    assert.equal((await post('/login', { email: ALICE.email, password: ALICE.password })).status, 200);
  });

  test('unknown or tampered tokens are rejected', async () => {
    const token = await request();
    for (const bad of ['0'.repeat(64), token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), 'x']) {
      assert.equal((await post('/reset-password', { token: bad, password: NEW })).status, 400);
    }
  });

  test('applies the password policy and keeps the token usable after a weak attempt', async () => {
    const token = await request();
    for (const password of ['short1', 'onlyletterslong', '12345678901']) {
      const res = await post('/reset-password', { token, password });
      assert.equal(res.status, 400);
      assert.ok(res.json.errors.password);
    }
    assert.equal((await post('/reset-password', { token, password: NEW })).status, 200);
  });

  test('a new request replaces the earlier token', async () => {
    const first = await request();
    await post('/forgot-password', { email: ALICE.email });
    const second = tokenFrom(app.control.mails.at(-1));
    assert.equal((await post('/reset-password', { token: first, password: NEW })).status, 400);
    assert.equal((await post('/reset-password', { token: second, password: NEW })).status, 200);
  });

  test('returns 503 when the database is unavailable', async () => {
    app.control.db = 'disconnected';
    assert.equal((await post('/forgot-password', { email: ALICE.email })).status, 503);
    assert.equal((await post('/reset-password', { token: 'x', password: NEW })).status, 503);
  });
});
