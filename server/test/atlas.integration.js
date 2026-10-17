// Opt-in integration test against a REAL MongoDB Atlas database. Run with `npm run test:atlas`.
// Safety rules: it only runs against MONGODB_TEST_URI, whose database name must end in "_test" and
// differ from MONGODB_URI's. It never drops or clears anything; it deletes only the users it created.
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const dbName = (uri) => { try { return new URL(uri).pathname.slice(1); } catch { return ''; } };
const testUri = process.env.MONGODB_TEST_URI;
const problem = !testUri ? 'MONGODB_TEST_URI is not set in server/.env'
  : !dbName(testUri).endsWith('_test') ? 'the database name in MONGODB_TEST_URI must end with "_test"'
  : dbName(testUri) === dbName(process.env.MONGODB_URI ?? '') ? 'MONGODB_TEST_URI must not point at the application database'
  : null;

const created = [];
let mongoose;
let User;
let server;
let base;

before(async () => {
  if (problem) return;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-'.padEnd(48, 'x');
  process.env.MONGODB_URI = testUri;
  ({ default: mongoose } = await import('mongoose'));
  ({ default: User } = await import('../src/models/User.js'));
  const { connectDb } = await import('../src/config/db.js');
  const { createApp } = await import('../src/app.js');
  await connectDb();
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  if (problem) return;
  if (created.length) await User.deleteMany({ email: { $in: created } });
  server.close();
  await mongoose.disconnect();
});

test('real Atlas: register, duplicate, hashing, login, me, logout', { skip: problem ?? false }, async () => {
  const email = `itest-${crypto.randomBytes(6).toString('hex')}@example.test`;
  created.push(email);
  const password = 'Hostel2026';
  const call = async (method, path, body, cookie) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) }, body: body && JSON.stringify(body) });
    return { status: res.status, json: await res.json(), cookie: res.headers.getSetCookie().find((c) => c.startsWith('token='))?.split(';')[0] };
  };

  const reg = await call('POST', '/api/auth/register', { name: 'Integration Test', email: email.toUpperCase(), password });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.email, email);
  assert.equal((await call('POST', '/api/auth/register', { name: 'Again', email, password })).status, 409);

  const raw = await mongoose.connection.collection('users').findOne({ email });
  assert.match(raw.passwordHash, /^\$2[aby]\$/);
  assert.ok(!JSON.stringify(raw).includes(password));
  assert.equal(await mongoose.connection.collection('users').countDocuments({ email }), 1);

  assert.equal((await call('POST', '/api/auth/login', { email, password: 'Wrong-pass1' })).status, 401);
  const login = await call('POST', '/api/auth/login', { email, password });
  assert.equal(login.status, 200);
  const me = await call('GET', '/api/auth/me', undefined, login.cookie);
  assert.equal(me.json.user.email, email);
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
  assert.equal((await call('POST', '/api/auth/logout')).status, 200);

  const health = await (await fetch(`${base}/api/health`)).json();
  assert.deepEqual([health.status, health.database], ['ok', 'connected']);
});

test('atlas integration prerequisites', { skip: !problem }, () => {
  console.log(`# SKIPPED real-Atlas test: ${problem}`);
});
