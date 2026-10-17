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
const now = new Date();
const THIS_MONTH = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
const LAST_MONTH = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString().slice(0, 10);
const NEXT_MONTH = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

const spend = (cookie, amount, extra = {}) =>
  app.request('POST', '/api/transactions', { cookie, body: { type: 'expense', amount, category: 'Food', date: THIS_MONTH, ...extra } });
const addBudget = async (cookie, body = { category: 'Food', limit: 1000 }) => (await app.request('POST', '/api/budgets', { body, cookie })).json.budget;
const view = async (cookie = alice) => (await app.request('GET', '/api/budgets', { cookie })).json.budgets[0];

before(async () => {
  app = await startApp();
  [alice, aliceId] = await register('Alice Khan', 'alice@example.com');
  [bob, bobId] = await register('Bob Shah', 'bob@example.com');
});
after(() => app.stop());
beforeEach(() => {
  app.control.db = 'connected';
  app.transactions.clear();
  app.budgets.clear();
});

describe('create and validate', () => {
  test('creates a budget owned by the logged-in student with zero spending', async () => {
    const res = await app.request('POST', '/api/budgets', { body: { category: 'Food', limit: 1000 }, cookie: alice });
    assert.equal(res.status, 201);
    assert.deepEqual({ ...res.json.budget, id: undefined }, { id: undefined, category: 'Food', limit: 1000, spent: 0, remaining: 1000, percentUsed: 0, status: 'ok' });
    assert.equal([...app.budgets.values()][0].owner, aliceId);
  });

  const invalid = {
    'missing fields': {},
    'zero limit': { category: 'Food', limit: 0 },
    'negative limit': { category: 'Food', limit: -5 },
    'string limit': { category: 'Food', limit: '500' },
    'three decimals': { category: 'Food', limit: 1.005 },
    'huge limit': { category: 'Food', limit: 1e12 },
    'income category': { category: 'Allowance', limit: 500 },
    'unknown category': { category: 'Nope', limit: 500 },
  };
  for (const [label, body] of Object.entries(invalid)) {
    test(`rejects ${label}`, async () => {
      const res = await app.request('POST', '/api/budgets', { body, cookie: alice });
      assert.equal(res.status, 400);
      assert.ok(Object.keys(res.json.errors).length > 0);
      assert.equal(app.budgets.size, 0);
    });
  }

  test('ignores forged owner and spending fields', async () => {
    const res = await app.request('POST', '/api/budgets', { body: { category: 'Food', limit: 1000, owner: bobId, userId: bobId, spent: 999, id: 'f'.repeat(24) }, cookie: alice });
    assert.equal(res.status, 201);
    const stored = app.budgets.get(res.json.budget.id);
    assert.equal(stored.owner, aliceId);
    assert.equal(stored.spent, undefined);
    assert.equal(res.json.budget.spent, 0);
  });

  test('rejects a second budget for the same category, but another student may have one', async () => {
    await addBudget(alice);
    const dup = await app.request('POST', '/api/budgets', { body: { category: 'Food', limit: 50 }, cookie: alice });
    assert.equal(dup.status, 409);
    assert.equal(app.budgets.size, 1);
    assert.equal((await app.request('POST', '/api/budgets', { body: { category: 'Food', limit: 50 }, cookie: bob })).status, 201);
  });
});

describe('spending calculation', () => {
  const cases = [
    ['0%', 0, 0, 'ok', 1000],
    ['79%', 790, 79, 'ok', 210],
    ['80%', 800, 80, 'warning', 200],
    ['100%', 1000, 100, 'warning', 0],
    ['above 100%', 1250.5, 125, 'exceeded', -250.5],
  ];
  for (const [label, amount, percent, status, remaining] of cases) {
    test(`at ${label}`, async () => {
      await addBudget(alice);
      if (amount) await spend(alice, amount);
      const b = await view();
      assert.deepEqual([b.spent, b.percentUsed, b.status, b.remaining, b.limit], [amount, percent, status, remaining, 1000]);
    });
  }

  test('counts only this month, this category, expenses, and this student', async () => {
    await addBudget(alice);
    await spend(alice, 100);
    await spend(alice, 200, { date: LAST_MONTH });
    await spend(alice, 300, { date: NEXT_MONTH });
    await spend(alice, 400, { category: 'Transport' });
    await app.request('POST', '/api/transactions', { cookie: alice, body: { type: 'income', amount: 500, category: 'Allowance', date: THIS_MONTH } });
    await spend(bob, 600);
    assert.equal((await view()).spent, 100);
  });

  test('is exact for decimal amounts and follows edits and deletes of transactions', async () => {
    await addBudget(alice, { category: 'Food', limit: 10 });
    await spend(alice, 0.1);
    const t = (await spend(alice, 0.2)).json.transaction;
    assert.equal((await view()).spent, 0.3);
    await app.request('DELETE', `/api/transactions/${t.id}`, { cookie: alice });
    assert.equal((await view()).spent, 0.1);
  });
});

describe('read, update, delete', () => {
  test('lists only the current student\'s budgets, sorted by category', async () => {
    await addBudget(alice, { category: 'Transport', limit: 300 });
    await addBudget(alice);
    await addBudget(bob, { category: 'Study', limit: 77 });
    const res = await app.request('GET', '/api/budgets', { cookie: alice });
    assert.deepEqual(res.json.budgets.map((b) => b.category), ['Food', 'Transport']);
    assert.ok(!res.text.includes('Study'));
  });

  test('returns, updates and deletes an owned budget', async () => {
    const b = await addBudget(alice);
    assert.equal((await app.request('GET', `/api/budgets/${b.id}`, { cookie: alice })).json.budget.id, b.id);
    const upd = await app.request('PATCH', `/api/budgets/${b.id}`, { body: { category: 'Study', limit: 250.5 }, cookie: alice });
    assert.deepEqual([upd.status, upd.json.budget.category, upd.json.budget.limit], [200, 'Study', 250.5]);
    assert.equal((await app.request('DELETE', `/api/budgets/${b.id}`, { cookie: alice })).status, 200);
    assert.equal(app.budgets.size, 0);
  });

  test('update validates, cannot change the owner, and cannot collide with another budget', async () => {
    const food = await addBudget(alice);
    await addBudget(alice, { category: 'Study', limit: 100 });
    assert.equal((await app.request('PATCH', `/api/budgets/${food.id}`, { body: { category: 'Food', limit: -1 }, cookie: alice })).status, 400);
    assert.equal((await app.request('PATCH', `/api/budgets/${food.id}`, { body: { category: 'Study', limit: 5 }, cookie: alice })).status, 409);
    await app.request('PATCH', `/api/budgets/${food.id}`, { body: { category: 'Food', limit: 5, owner: bobId }, cookie: alice });
    assert.equal(app.budgets.get(food.id).owner, aliceId);
  });
});

describe('ownership and failures', () => {
  test('another student gets 404 on read, edit and delete and the budget is untouched', async () => {
    const b = await addBudget(alice);
    const url = `/api/budgets/${b.id}`;
    assert.equal((await app.request('GET', url, { cookie: bob })).status, 404);
    assert.equal((await app.request('PATCH', url, { body: { category: 'Food', limit: 1 }, cookie: bob })).status, 404);
    assert.equal((await app.request('DELETE', url, { cookie: bob })).status, 404);
    assert.equal(app.budgets.get(b.id).limit, 1000);
  });

  test('every endpoint requires authentication', async () => {
    const b = await addBudget(alice);
    for (const [method, path] of [['GET', '/api/budgets'], ['POST', '/api/budgets'], ['GET', `/api/budgets/${b.id}`], ['PATCH', `/api/budgets/${b.id}`], ['DELETE', `/api/budgets/${b.id}`]]) {
      const res = await app.request(method, path, { body: method === 'POST' || method === 'PATCH' ? { category: 'Food', limit: 5 } : undefined });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
    assert.equal(app.budgets.size, 1);
  });

  test('malformed ids give 400 and unknown ids give 404', async () => {
    for (const id of ['abc', 'z'.repeat(24)]) assert.equal((await app.request('GET', `/api/budgets/${id}`, { cookie: alice })).status, 400);
    assert.equal((await app.request('GET', `/api/budgets/${'a'.repeat(24)}`, { cookie: alice })).status, 404);
    assert.equal((await app.request('DELETE', `/api/budgets/${'a'.repeat(24)}`, { cookie: alice })).status, 404);
  });

  test('untrusted origins are blocked and an unavailable database gives 503', async () => {
    const blocked = await app.request('POST', '/api/budgets', { body: { category: 'Food', limit: 5 }, cookie: alice, headers: { Origin: 'https://evil.example' } });
    assert.equal(blocked.status, 403);
    app.control.db = 'disconnected';
    assert.equal((await app.request('GET', '/api/budgets', { cookie: alice })).status, 503);
  });
});
