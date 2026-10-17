import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './setup.js';

let app;
const VALID = { name: 'Ayesha Khan', email: 'Ayesha@Example.com', subject: 'Idea', message: 'Please add a dark chart for monthly spending.' };
const send = (body) => app.request('POST', '/api/contact', { body });

describe('contact form', () => {
  before(async () => { app = await startApp(); });
  after(() => app.stop());
  beforeEach(() => {
    app.control.db = 'connected';
    app.control.feedbackFails = false;
    app.feedback.length = 0;
  });

  test('accepts a valid message without login and stores it', async () => {
    const res = await send(VALID);
    assert.equal(res.status, 201);
    assert.match(res.json.message, /received/i);
    assert.deepEqual(app.feedback, [{ name: 'Ayesha Khan', email: 'ayesha@example.com', subject: 'Idea', message: VALID.message }]);
  });

  test('subject is optional', async () => {
    const { subject, ...body } = VALID;
    assert.equal((await send(body)).status, 201);
    assert.equal(app.feedback[0].subject, '');
  });

  const invalid = {
    'missing fields': {},
    'short name': { ...VALID, name: 'A' },
    'bad email': { ...VALID, email: 'nope' },
    'short message': { ...VALID, message: 'too short' },
    'long message': { ...VALID, message: 'x'.repeat(2001) },
    'long subject': { ...VALID, subject: 'x'.repeat(121) },
    'long name': { ...VALID, name: 'x'.repeat(81) },
    'non-string values': { name: 1, email: ['a'], message: { a: 1 } },
  };
  for (const [label, body] of Object.entries(invalid)) {
    test(`rejects ${label} with field errors and stores nothing`, async () => {
      const res = await send(body);
      assert.equal(res.status, 400);
      assert.ok(Object.keys(res.json.errors).length > 0);
      assert.equal(app.feedback.length, 0);
    });
  }

  test('a filled honeypot looks successful but stores nothing', async () => {
    assert.equal((await send({ ...VALID, website: 'http://spam.example' })).status, 201);
    assert.equal(app.feedback.length, 0);
  });

  test('never reports success when saving fails, and hides the cause', async () => {
    app.control.feedbackFails = true;
    const res = await send(VALID);
    assert.equal(res.status, 500);
    assert.doesNotMatch(res.text, /db down|received/i);
  });

  test('is unavailable (503) when the database is down', async () => {
    app.control.db = 'disconnected';
    assert.equal((await send(VALID)).status, 503);
  });

  test('blocks untrusted origins', async () => {
    const res = await app.request('POST', '/api/contact', { body: VALID, headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
    assert.equal(app.feedback.length, 0);
  });
});
