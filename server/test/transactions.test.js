import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './setup.js';

let app;
let alice;
let bob;
let aliceId;
let bobId;

const register = async (name, email) => {
  const res = await app.request('POST', '/api/auth/register', { body: { name, email, password: 'Hostel2026' } });
  return [res.cookie, res.json.user.id];
};
const INCOME = { type: 'income', amount: 40000, category: 'Allowance', description: 'Monthly allowance', date: '2026-10-01' };
const EXPENSE = { type: 'expense', amount: 3200.5, category: 'Food', description: 'Mess bill', date: '2026-10-12' };
const add = async (cookie, body) => (await app.request('POST', '/api/transactions', { body, cookie })).json.transaction;

before(async () => {
  app = await startApp();
  [alice, aliceId] = await register('Alice Khan', 'alice@example.com');
  [bob, bobId] = await register('Bob Shah', 'bob@example.com');
});
after(() => app.stop());
beforeEach(() => {
  app.control.db = 'connected';
  app.transactions.clear();
});

describe('create', () => {
  test('creates income and expense records owned by the logged-in student', async () => {
    for (const body of [INCOME, EXPENSE]) {
      const res = await app.request('POST', '/api/transactions', { body, cookie: alice });
      assert.equal(res.status, 201);
      assert.deepEqual({ ...res.json.transaction, id: undefined }, { ...body, id: undefined });
    }
    assert.ok([...app.transactions.values()].every((t) => t.owner === aliceId));
  });

  test('description is optional', async () => {
    const { description, ...body } = EXPENSE;
    const res = await app.request('POST', '/api/transactions', { body, cookie: alice });
    assert.equal(res.status, 201);
    assert.equal(res.json.transaction.description, '');
  });

  const invalid = {
    'missing fields': {},
    'zero amount': { ...EXPENSE, amount: 0 },
    'negative amount': { ...EXPENSE, amount: -5 },
    'string amount': { ...EXPENSE, amount: '50' },
    'null amount': { ...EXPENSE, amount: null },
    'three decimals': { ...EXPENSE, amount: 1.005 },
    'huge amount': { ...EXPENSE, amount: 1e12 },
    'bad type': { ...EXPENSE, type: 'gift' },
    'category from the other type': { ...EXPENSE, category: 'Allowance' },
    'unknown category': { ...EXPENSE, category: 'Nope' },
    'impossible date': { ...EXPENSE, date: '2026-02-31' },
    'malformed date': { ...EXPENSE, date: '12/10/2026' },
    'long description': { ...EXPENSE, description: 'x'.repeat(201) },
  };
  for (const [label, body] of Object.entries(invalid)) {
    test(`rejects ${label}`, async () => {
      const res = await app.request('POST', '/api/transactions', { body, cookie: alice });
      assert.equal(res.status, 400);
      assert.ok(Object.keys(res.json.errors).length > 0);
      assert.equal(app.transactions.size, 0);
    });
  }

  test('ignores forged owner and id fields', async () => {
    const forged = { ...EXPENSE, owner: bobId, userId: bobId, _id: 'f'.repeat(24), id: 'f'.repeat(24) };
    const res = await app.request('POST', '/api/transactions', { body: forged, cookie: alice });
    assert.equal(res.status, 201);
    const stored = app.transactions.get(res.json.transaction.id);
    assert.equal(stored.owner, aliceId);
    assert.notEqual(res.json.transaction.id, 'f'.repeat(24));
    assert.equal(stored.userId, undefined);
  });
});

describe('read', () => {
  test("lists only the current student's records, newest first", async () => {
    await add(alice, INCOME);
    await add(alice, EXPENSE);
    await add(bob, { ...EXPENSE, description: 'Bob only' });
    const res = await app.request('GET', '/api/transactions', { cookie: alice });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.transactions.map((t) => t.date), ['2026-10-12', '2026-10-01']);
    assert.ok(!res.text.includes('Bob only'));
  });

  test('returns an owned record', async () => {
    const t = await add(alice, EXPENSE);
    const res = await app.request('GET', `/api/transactions/${t.id}`, { cookie: alice });
    assert.equal(res.status, 200);
    assert.equal(res.json.transaction.id, t.id);
  });
});

describe('update and delete', () => {
  test('updates an owned record', async () => {
    const t = await add(alice, EXPENSE);
    const res = await app.request('PATCH', `/api/transactions/${t.id}`, { body: { ...EXPENSE, amount: 99, category: 'Transport', description: '' }, cookie: alice });
    assert.equal(res.status, 200);
    assert.deepEqual([res.json.transaction.amount, res.json.transaction.category, res.json.transaction.description], [99, 'Transport', '']);
  });

  test('update cannot change the owner', async () => {
    const t = await add(alice, EXPENSE);
    await app.request('PATCH', `/api/transactions/${t.id}`, { body: { ...EXPENSE, owner: bobId }, cookie: alice });
    assert.equal(app.transactions.get(t.id).owner, aliceId);
  });

  test('update validates like create', async () => {
    const t = await add(alice, EXPENSE);
    const res = await app.request('PATCH', `/api/transactions/${t.id}`, { body: { ...EXPENSE, amount: -1 }, cookie: alice });
    assert.equal(res.status, 400);
    assert.equal(app.transactions.get(t.id).amount, EXPENSE.amount);
  });

  test('deletes an owned record', async () => {
    const t = await add(alice, EXPENSE);
    const res = await app.request('DELETE', `/api/transactions/${t.id}`, { cookie: alice });
    assert.equal(res.status, 200);
    assert.equal(app.transactions.size, 0);
  });
});

describe('ownership and bad requests', () => {
  test('another student cannot read, edit or delete a record (404, record untouched)', async () => {
    const t = await add(alice, EXPENSE);
    const url = `/api/transactions/${t.id}`;
    assert.equal((await app.request('GET', url, { cookie: bob })).status, 404);
    assert.equal((await app.request('PATCH', url, { body: { ...EXPENSE, amount: 1 }, cookie: bob })).status, 404);
    assert.equal((await app.request('DELETE', url, { cookie: bob })).status, 404);
    assert.equal(app.transactions.get(t.id).amount, EXPENSE.amount);
  });

  test('every endpoint requires authentication', async () => {
    const t = await add(alice, EXPENSE);
    for (const [method, path] of [['GET', '/api/transactions'], ['GET', '/api/transactions/summary'], ['POST', '/api/transactions'], ['GET', `/api/transactions/${t.id}`], ['PATCH', `/api/transactions/${t.id}`], ['DELETE', `/api/transactions/${t.id}`]]) {
      const res = await app.request(method, path, { body: method === 'GET' || method === 'DELETE' ? undefined : EXPENSE });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
    assert.equal(app.transactions.size, 1);
  });

  test('malformed ids give 400 and unknown ids give 404', async () => {
    for (const id of ['abc', '123', 'z'.repeat(24), '%7B%24ne%7D']) {
      assert.equal((await app.request('GET', `/api/transactions/${id}`, { cookie: alice })).status, 400, id);
    }
    assert.equal((await app.request('GET', `/api/transactions/${'a'.repeat(24)}`, { cookie: alice })).status, 404);
    assert.equal((await app.request('DELETE', `/api/transactions/${'a'.repeat(24)}`, { cookie: alice })).status, 404);
  });

  test('state-changing requests from an untrusted origin are blocked', async () => {
    const res = await app.request('POST', '/api/transactions', { body: EXPENSE, cookie: alice, headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
    assert.equal(app.transactions.size, 0);
  });

  test('returns 503 when the database is unavailable', async () => {
    app.control.db = 'disconnected';
    assert.equal((await app.request('GET', '/api/transactions', { cookie: alice })).status, 503);
  });
});

describe('summary', () => {
  test('is empty for a new student', async () => {
    const res = await app.request('GET', '/api/transactions/summary', { cookie: alice });
    assert.deepEqual(res.json, { totalIncome: 0, totalExpenses: 0, balance: 0, count: 0, recent: [] });
  });

  test("totals only the student's own records, exactly", async () => {
    await add(alice, INCOME);
    await add(alice, EXPENSE);
    await add(alice, { ...EXPENSE, amount: 0.1 });
    await add(alice, { ...EXPENSE, amount: 0.2 });
    await add(bob, { ...INCOME, amount: 1e6 });
    const res = await app.request('GET', '/api/transactions/summary', { cookie: alice });
    assert.equal(res.json.totalIncome, 40000);
    assert.equal(res.json.totalExpenses, 3200.8);
    assert.equal(res.json.balance, 36799.2);
    assert.equal(res.json.count, 4);
    assert.equal(res.json.recent.length, 4);
  });
});
