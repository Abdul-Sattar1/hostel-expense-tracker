import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startApp } from './setup.js';

let app;
const PASSWORD = 'Hostel2026';
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const tokenFrom = (mail) => new URL(mail.link).searchParams.get('token');
const byEmail = (email) => [...app.users.values()].find((u) => u.email === email);

const signUp = async (name, email) => {
  const res = await app.request('POST', '/api/auth/register', { body: { name, email, password: PASSWORD } });
  return { cookie: res.cookie, id: res.json.user.id, email };
};
const call = (method, path, cookie, body) => app.request(method, `/api/profile${path}`, { cookie, body });
const login = (email, password) => app.request('POST', '/api/auth/login', { body: { email, password } });

// Minimal valid files: only the signature bytes the server checks, padded to a plausible size.
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([40, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(40, 3)]);
const upload = (cookie, body, type = 'image/png') => app.request('PUT', '/api/profile/avatar', { cookie, body, headers: { 'Content-Type': type } });

let alice;
let bob;

before(async () => { app = await startApp(); });
after(() => app.stop());
beforeEach(async () => {
  app.control.db = 'connected';
  app.control.mails.length = 0;
  app.control.mailFails = false;
  app.users.clear();
  app.avatars.clear();
  alice = await signUp('Alice Khan', 'alice@example.com');
  bob = await signUp('Bob Shah', 'bob@example.com');
});

describe('profile details', () => {
  test('updates the name and returns the refreshed user', async () => {
    const res = await call('PATCH', '', alice.cookie, { name: '  Alice K. Khan ' });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.name, 'Alice K. Khan');
    assert.equal((await app.request('GET', '/api/auth/me', { cookie: alice.cookie })).json.user.name, 'Alice K. Khan');
  });

  test('rejects invalid names', async () => {
    for (const name of ['', 'A', 'x'.repeat(81), 123, null]) assert.equal((await call('PATCH', '', alice.cookie, { name })).status, 400, String(name));
  });

  test('ignores protected fields sent by the client', async () => {
    const before = { ...byEmail('alice@example.com') };
    await call('PATCH', '', alice.cookie, { name: 'Alice Two', email: 'evil@example.com', id: bob.id, passwordHash: 'x', googleId: 'g', role: 'admin', pendingEmail: 'z@example.com' });
    const after = byEmail('alice@example.com');
    assert.ok(after, 'email unchanged');
    assert.deepEqual([after.id, after.passwordHash, after.googleId, after.role, after.pendingEmail], [before.id, before.passwordHash, undefined, undefined, undefined]);
    assert.equal(byEmail('bob@example.com').name, 'Bob Shah');
  });

  test('every endpoint except the emailed-link check requires login', async () => {
    for (const [method, path] of [['PATCH', ''], ['POST', '/email'], ['POST', '/password'], ['GET', '/avatar'], ['PUT', '/avatar'], ['DELETE', '/avatar']]) {
      assert.equal((await call(method, path, undefined, method === 'GET' || method === 'DELETE' ? undefined : { name: 'Zed Zed' })).status, 401, `${method} ${path}`);
    }
  });

  test('returns 503 when the database is unavailable', async () => {
    app.control.db = 'disconnected';
    assert.equal((await call('PATCH', '', alice.cookie, { name: 'Alice Two' })).status, 503);
  });
});

describe('email change with verification', () => {
  const NEW = 'alice.new@example.com';
  const request = (body, cookie = alice.cookie) => call('POST', '/email', cookie, body);

  test('stores the new address as pending and mails a token to it; the active email does not change', async () => {
    const res = await request({ email: NEW.toUpperCase(), password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.json.user.email, 'alice@example.com');
    assert.equal(res.json.user.pendingEmail, NEW);
    assert.equal(app.control.mails.length, 1);
    assert.equal(app.control.mails[0].to, NEW);
    const token = tokenFrom(app.control.mails[0]);
    assert.match(token, /^[a-f0-9]{64}$/);
    const rec = byEmail('alice@example.com');
    assert.equal(rec.pendingEmailHash, sha256(token));
    assert.ok(!JSON.stringify(rec).includes(token));
    assert.ok(!res.text.includes(token) && !res.text.includes(rec.pendingEmailHash));
    assert.equal((await login('alice@example.com', PASSWORD)).status, 200);
    assert.equal((await login(NEW, PASSWORD)).status, 401);
  });

  test('requires the current password (400, not 401, so the session stays valid)', async () => {
    for (const password of ['Wrong-pass1', '', undefined]) {
      const res = await request({ email: NEW, password });
      assert.equal(res.status, 400);
      assert.ok(res.json.errors.password);
    }
    assert.equal(app.control.mails.length, 0);
    assert.equal((await app.request('GET', '/api/auth/me', { cookie: alice.cookie })).status, 200);
  });

  test('rejects invalid, unchanged and already-registered addresses', async () => {
    assert.equal((await request({ email: 'nope', password: PASSWORD })).status, 400);
    assert.equal((await request({ email: 'alice@example.com', password: PASSWORD })).status, 400);
    const dup = await request({ email: 'BOB@example.com', password: PASSWORD });
    assert.equal(dup.status, 409);
    assert.ok(dup.json.errors.email);
    assert.equal(app.control.mails.length, 0);
  });

  test('confirming the link switches the email, once, and old/new logins behave', async () => {
    await request({ email: NEW, password: PASSWORD });
    const token = tokenFrom(app.control.mails[0]);
    const ok = await call('POST', '/email/verify', undefined, { token });
    assert.equal(ok.status, 200);
    const rec = [...app.users.values()].find((u) => u.id === alice.id);
    assert.deepEqual([rec.email, rec.pendingEmail, rec.pendingEmailHash, rec.pendingEmailExpires], [NEW, undefined, undefined, undefined]);
    assert.equal((await call('POST', '/email/verify', undefined, { token })).status, 400);
    assert.equal((await login('alice@example.com', PASSWORD)).status, 401);
    assert.equal((await login(NEW, PASSWORD)).status, 200);
    assert.equal((await app.request('GET', '/api/auth/me', { cookie: alice.cookie })).json.user.email, NEW);
  });

  test('expired, unknown and tampered tokens are rejected and change nothing', async () => {
    await request({ email: NEW, password: PASSWORD });
    const token = tokenFrom(app.control.mails[0]);
    byEmail('alice@example.com').pendingEmailExpires = new Date(Date.now() - 1000);
    for (const bad of [token, '0'.repeat(64), token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), 'x']) {
      assert.equal((await call('POST', '/email/verify', undefined, { token: bad })).status, 400);
    }
    assert.ok(byEmail('alice@example.com'));
  });

  test('a newer request replaces the earlier token', async () => {
    await request({ email: NEW, password: PASSWORD });
    await request({ email: 'other.new@example.com', password: PASSWORD });
    const [first, second] = app.control.mails.map(tokenFrom);
    assert.equal((await call('POST', '/email/verify', undefined, { token: first })).status, 400);
    assert.equal((await call('POST', '/email/verify', undefined, { token: second })).status, 200);
    assert.ok(byEmail('other.new@example.com'));
  });

  test('if the address gets taken before confirming, the change fails safely', async () => {
    await request({ email: NEW, password: PASSWORD });
    const token = tokenFrom(app.control.mails[0]);
    await signUp('Mallory', NEW);
    assert.equal((await call('POST', '/email/verify', undefined, { token })).status, 409);
    assert.ok(byEmail('alice@example.com'));
  });

  test('confirming also cancels an outstanding password-reset link', async () => {
    await app.request('POST', '/api/auth/forgot-password', { body: { email: 'alice@example.com' } });
    await request({ email: NEW, password: PASSWORD });
    await call('POST', '/email/verify', undefined, { token: tokenFrom(app.control.mails.at(-1)) });
    const reset = [...app.users.values()].find((u) => u.id === alice.id);
    assert.equal(reset.resetTokenHash, undefined);
  });

  test('a mail failure is reported honestly and leaves nothing pending', async () => {
    app.control.mailFails = true;
    const res = await request({ email: NEW, password: PASSWORD });
    assert.equal(res.status, 503);
    assert.equal(byEmail('alice@example.com').pendingEmail, undefined);
    assert.equal(byEmail('alice@example.com').pendingEmailHash, undefined);
  });

  test('Google accounts cannot change their email here', async () => {
    app.control.google = () => ({ id: 'g-1', email: 'gina@example.com', emailVerified: true, name: 'Gina' });
    const g = await app.request('POST', '/api/auth/google', { body: { credential: 'x' } });
    const res = await request({ email: NEW, password: PASSWORD }, g.cookie);
    assert.equal(res.status, 403);
    assert.equal(app.control.mails.length, 0);
  });
});

describe('password change', () => {
  const change = (body, cookie = alice.cookie) => call('POST', '/password', cookie, body);

  test('changes the password with the current one; the old one stops working', async () => {
    const res = await change({ currentPassword: PASSWORD, newPassword: 'Brand-new-2026' });
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.text, /passwordHash|\$2[aby]\$/);
    const rec = byEmail('alice@example.com');
    assert.match(rec.passwordHash, /^\$2[aby]\$\d\d\$/);
    assert.notEqual(rec.passwordHash, 'Brand-new-2026');
    assert.equal((await login('alice@example.com', PASSWORD)).status, 401);
    assert.equal((await login('alice@example.com', 'Brand-new-2026')).status, 200);
  });

  test('rejects a wrong current password (400) and keeps the session', async () => {
    const res = await change({ currentPassword: 'Wrong-pass1', newPassword: 'Brand-new-2026' });
    assert.equal(res.status, 400);
    assert.ok(res.json.errors.currentPassword);
    assert.equal((await app.request('GET', '/api/auth/me', { cookie: alice.cookie })).status, 200);
    assert.equal((await login('alice@example.com', PASSWORD)).status, 200);
  });

  test('applies the password policy and rejects reusing the current password', async () => {
    for (const newPassword of ['short1', 'onlyletterslong', '12345678901', 123]) {
      assert.equal((await change({ currentPassword: PASSWORD, newPassword })).status, 400, String(newPassword));
    }
    const same = await change({ currentPassword: PASSWORD, newPassword: PASSWORD });
    assert.equal(same.status, 400);
    assert.ok(same.json.errors.newPassword);
  });

  test('is only possible for the logged-in account', async () => {
    await change({ currentPassword: PASSWORD, newPassword: 'Brand-new-2026' });
    assert.equal((await login('bob@example.com', PASSWORD)).status, 200);
  });

  test('Google-only accounts have no password to change', async () => {
    app.control.google = () => ({ id: 'g-1', email: 'gina@example.com', emailVerified: true, name: 'Gina' });
    const g = await app.request('POST', '/api/auth/google', { body: { credential: 'x' } });
    assert.equal(g.json.user.hasPassword, false);
    const res = await change({ currentPassword: 'anything1', newPassword: 'Brand-new-2026' }, g.cookie);
    assert.equal(res.status, 400);
    assert.equal([...app.users.values()].find((u) => u.googleId).passwordHash, undefined);
  });
});

describe('profile picture', () => {
  test('accepts JPEG, PNG and WebP and serves them with the detected type', async () => {
    for (const [file, type] of [[png, 'image/png'], [jpeg, 'image/jpeg'], [webp, 'image/webp']]) {
      const up = await upload(alice.cookie, file, 'application/octet-stream');
      assert.equal(up.status, 200, type);
      assert.ok(up.json.user.avatarUpdatedAt);
      const get = await app.request('GET', '/api/profile/avatar', { cookie: alice.cookie });
      assert.equal(get.status, 200);
      assert.equal(get.headers.get('content-type'), type);
      assert.ok(get.buffer.equals(file));
      assert.equal(get.headers.get('x-content-type-options'), 'nosniff');
      assert.match(get.headers.get('cache-control'), /private/);
    }
    assert.equal(app.avatars.size, 1);
  });

  test('judges the content, not the claimed type or filename', async () => {
    assert.equal((await upload(alice.cookie, Buffer.from('<?php echo 1; ?> not an image at all'), 'image/png')).status, 415);
    assert.equal((await upload(alice.cookie, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml')).status, 415);
    assert.equal((await upload(alice.cookie, Buffer.from('GIF89a' + 'x'.repeat(40)), 'image/gif')).status, 415);
    assert.equal((await upload(alice.cookie, Buffer.from('RIFF....WAVE' + 'x'.repeat(40)), 'image/webp')).status, 415);
    assert.equal((await upload(alice.cookie, Buffer.from([0x89, 0x50]), 'image/png')).status, 415);
    assert.equal((await upload(alice.cookie, png, 'text/html')).status, 200);
    assert.equal(app.avatars.size, 1);
  });

  test('rejects empty uploads and anything over 2 MB', async () => {
    assert.equal((await upload(alice.cookie, Buffer.alloc(0))).status, 400);
    const big = Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]);
    assert.equal((await upload(alice.cookie, big)).status, 413);
    const ok = Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024 - png.length)]);
    assert.equal((await upload(alice.cookie, ok)).status, 200);
  });

  test('each picture belongs to its owner only', async () => {
    await upload(alice.cookie, png);
    assert.equal((await app.request('GET', '/api/profile/avatar', { cookie: bob.cookie })).status, 404);
    await upload(bob.cookie, jpeg);
    const mine = await app.request('GET', '/api/profile/avatar', { cookie: alice.cookie });
    assert.ok(mine.buffer.equals(png));
    assert.equal(app.avatars.size, 2);
    assert.equal((await app.request('GET', '/api/profile/avatar?owner=' + bob.id, { cookie: alice.cookie })).buffer.equals(png), true);
  });

  test('removing deletes the stored file and clears the user marker without affecting others', async () => {
    await upload(alice.cookie, png);
    await upload(bob.cookie, jpeg);
    const res = await call('DELETE', '/avatar', alice.cookie);
    assert.equal(res.status, 200);
    assert.equal(res.json.user.avatarUpdatedAt, null);
    assert.equal((await app.request('GET', '/api/profile/avatar', { cookie: alice.cookie })).status, 404);
    assert.equal((await app.request('GET', '/api/profile/avatar', { cookie: bob.cookie })).status, 200);
  });

  test('replacing keeps a single record per user', async () => {
    await upload(alice.cookie, png);
    await upload(alice.cookie, webp);
    assert.equal(app.avatars.size, 1);
    assert.equal((await app.request('GET', '/api/profile/avatar', { cookie: alice.cookie })).headers.get('content-type'), 'image/webp');
  });

  test('uploads from an untrusted origin are blocked', async () => {
    const res = await app.request('PUT', '/api/profile/avatar', { cookie: alice.cookie, body: png, headers: { 'Content-Type': 'image/png', Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
    assert.equal(app.avatars.size, 0);
  });
});

describe('preferences', () => {
  const put = (body, cookie = alice.cookie) => call('PUT', '/preferences', cookie, body);

  test('default to monthly reports and the dashboard, and are saved to the account', async () => {
    assert.deepEqual((await app.request('GET', '/api/auth/me', { cookie: alice.cookie })).json.user.preferences, { reportPeriod: 'month', landingPage: 'dashboard' });
    const res = await put({ reportPeriod: 'year', landingPage: 'reports' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.user.preferences, { reportPeriod: 'year', landingPage: 'reports' });
    assert.deepEqual((await app.request('GET', '/api/auth/me', { cookie: alice.cookie })).json.user.preferences, { reportPeriod: 'year', landingPage: 'reports' });
  });

  test('rejects unknown values and ignores extra fields', async () => {
    for (const body of [{}, { reportPeriod: 'week', landingPage: 'reports' }, { reportPeriod: 'month', landingPage: '/admin' }, { reportPeriod: 'custom', landingPage: 'budgets' }]) {
      assert.equal((await put(body)).status, 400, JSON.stringify(body));
    }
    await put({ reportPeriod: 'all', landingPage: 'budgets', role: 'admin', currency: 'USD' });
    assert.deepEqual(byEmail('alice@example.com').preferences, { reportPeriod: 'all', landingPage: 'budgets' });
  });

  test('only change the logged-in account', async () => {
    await put({ reportPeriod: 'year', landingPage: 'reports' });
    assert.deepEqual((await app.request('GET', '/api/auth/me', { cookie: bob.cookie })).json.user.preferences, { reportPeriod: 'month', landingPage: 'dashboard' });
    assert.equal((await put({ reportPeriod: 'year', landingPage: 'reports' }, null)).status, 401);
  });
});

describe('delete account', () => {
  const remove = (body, cookie = alice.cookie) => call('POST', '/delete', cookie, body);
  const seedData = async (who) => {
    await app.request('POST', '/api/transactions', { cookie: who.cookie, body: { type: 'expense', amount: 5, category: 'Food', date: '2026-10-01' } });
    await app.request('POST', '/api/budgets', { cookie: who.cookie, body: { category: 'Food', limit: 100 } });
    await upload(who.cookie, png);
  };
  const countFor = (id) => [...app.transactions.values()].filter((t) => t.owner === id).length + [...app.budgets.values()].filter((b) => b.owner === id).length + (app.avatars.has(id) ? 1 : 0);

  test('with the password and typed confirmation removes the account and all its data, and only that', async () => {
    await seedData(alice);
    await seedData(bob);
    const res = await remove({ password: PASSWORD, confirmation: 'DELETE' });
    assert.equal(res.status, 200);
    assert.match(res.setCookie.find((c) => c.startsWith('token=')), /token=;/);
    assert.equal(byEmail('alice@example.com'), undefined);
    assert.equal(countFor(alice.id), 0);
    assert.equal(countFor(bob.id), 3);
    assert.ok(byEmail('bob@example.com'));
    assert.equal((await app.request('GET', '/api/auth/me', { cookie: alice.cookie })).status, 401);
    assert.equal((await login('alice@example.com', PASSWORD)).status, 401);
  });

  test('a wrong password (400, session kept) or missing confirmation deletes nothing', async () => {
    await seedData(alice);
    const wrong = await remove({ password: 'Wrong-pass1', confirmation: 'DELETE' });
    assert.equal(wrong.status, 400);
    assert.ok(wrong.json.errors.password);
    for (const body of [{ password: PASSWORD }, { password: PASSWORD, confirmation: 'delete' }, { confirmation: 'DELETE' }]) {
      assert.notEqual((await remove(body)).status, 200);
    }
    assert.ok(byEmail('alice@example.com'));
    assert.equal(countFor(alice.id), 3);
    assert.equal((await app.request('GET', '/api/auth/me', { cookie: alice.cookie })).status, 200);
  });

  test('requires login', async () => {
    assert.equal((await remove({ password: PASSWORD, confirmation: 'DELETE' }, null)).status, 401);
    assert.equal(app.users.size, 2);
  });

  test('Google-only accounts must re-confirm with their own Google credential', async () => {
    const profile = { id: 'g-1', email: 'gina@example.com', emailVerified: true, name: 'Gina' };
    app.control.google = (credential) => {
      if (!credential) throw new Error('missing credential');
      return profile;
    };
    const g = await app.request('POST', '/api/auth/google', { body: { credential: 'x' } });
    const gina = { cookie: g.cookie, id: g.json.user.id };
    await seedData(gina);
    assert.equal((await remove({ confirmation: 'DELETE' }, gina.cookie)).status, 400);
    app.control.google = () => { throw new Error('bad token'); };
    assert.equal((await remove({ credential: 'forged', confirmation: 'DELETE' }, gina.cookie)).status, 400);
    app.control.google = () => ({ ...profile, id: 'someone-else' });
    assert.equal((await remove({ credential: 'other-account', confirmation: 'DELETE' }, gina.cookie)).status, 400);
    assert.equal(countFor(gina.id), 3);
    app.control.google = (credential) => (credential ? profile : (() => { throw new Error('missing'); })());
    assert.equal((await remove({ credential: 'ok', confirmation: 'DELETE' }, gina.cookie)).status, 200);
    assert.equal(countFor(gina.id), 0);
    assert.equal([...app.users.values()].some((u) => u.googleId), false);
  });
});
