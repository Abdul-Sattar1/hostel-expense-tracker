import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { env } = await import('../src/config/env.js');
const { sendResetEmail, sendVerificationEmail } = await import('../src/services/mailer.js');
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  env.mail.brevoKey = undefined;
  env.mail.host = undefined;
});

// Mocked HTTP: proves the request we build, not that Brevo accepts it.
test('sends through the Brevo HTTPS API with the key in a header, not the body', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201 }; };
  env.mail.brevoKey = 'test-key';
  env.mail.from = 'Hostel Expense Tracker <sender@example.com>';
  await sendResetEmail('student@example.com', 'https://app.example/reset-password?token=abc', 20);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].init.headers['api-key'], 'test-key');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.sender, { name: 'Hostel Expense Tracker', email: 'sender@example.com' });
  assert.deepEqual(body.to, [{ email: 'student@example.com' }]);
  assert.match(body.textContent, /reset-password\?token=abc/);
  assert.ok(!JSON.stringify(body).includes('test-key'));
});

test('accepts a plain address as the sender and works for verification emails', async () => {
  let body;
  globalThis.fetch = async (_u, init) => { body = JSON.parse(init.body); return { ok: true, status: 201 }; };
  env.mail.brevoKey = 'test-key';
  env.mail.from = 'sender@example.com';
  await sendVerificationEmail('new@example.com', 'https://app.example/verify-email?token=t', 60);
  assert.deepEqual(body.sender, { email: 'sender@example.com' });
  assert.match(body.subject, /Confirm/);
});

test('a provider error is thrown without leaking the key or response body', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'secret detail' });
  env.mail.brevoKey = 'test-key';
  env.mail.from = 'sender@example.com';
  await assert.rejects(sendResetEmail('a@example.com', 'https://x', 20), (e) => /HTTP 401/.test(e.message) && !/test-key|secret detail/.test(e.message));
});

test('a missing sender address is a clear error, and no provider means nothing is claimed as sent in production', async () => {
  globalThis.fetch = async () => { throw new Error('should not be called'); };
  env.mail.brevoKey = 'test-key';
  env.mail.from = undefined;
  await assert.rejects(sendResetEmail('a@example.com', 'https://x', 20), /MAIL_FROM/);
  env.mail.brevoKey = undefined;
  env.isProd = true;
  await assert.rejects(sendResetEmail('a@example.com', 'https://x', 20), /No email provider/);
  env.isProd = false;
});
