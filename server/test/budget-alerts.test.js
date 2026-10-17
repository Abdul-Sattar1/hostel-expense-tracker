import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './setup.js';

let app;
let alice;
let bob;

const register = async (name, email) => (await app.request('POST', '/api/auth/register', { body: { name, email, password: 'Hostel2026' } })).cookie;
const now = new Date();
const THIS_MONTH = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
const LAST_MONTH = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString().slice(0, 10);

const expense = (amount, extra = {}) => ({ type: 'expense', amount, category: 'Food', date: THIS_MONTH, ...extra });
const add = (body, cookie = alice) => app.request('POST', '/api/transactions', { body, cookie });
const edit = (id, body, cookie = alice) => app.request('PATCH', `/api/transactions/${id}`, { body, cookie });
const budget = (category, limit, cookie = alice) => app.request('POST', '/api/budgets', { body: { category, limit }, cookie });

before(async () => {
  app = await startApp();
  alice = await register('Alice Khan', 'alice@example.com');
  bob = await register('Bob Shah', 'bob@example.com');
});
after(() => app.stop());
beforeEach(async () => {
  app.control.db = 'connected';
  app.control.failBudgets = false;
  app.transactions.clear();
  app.budgets.clear();
  await budget('Food', 1000);
});

describe('creating an expense', () => {
  test('below 80% gives no alert', async () => {
    const res = await add(expense(790));
    assert.equal(res.status, 201);
    assert.equal(res.json.budgetAlert, undefined);
    assert.equal(res.json.budgetCheckFailed, undefined);
  });

  test('crossing 80% warns with the server-calculated numbers', async () => {
    await add(expense(500));
    const res = await add(expense(350));
    assert.deepEqual(res.json.budgetAlert, { ...res.json.budgetAlert, category: 'Food', limit: 1000, spent: 850, remaining: 150, percentUsed: 85, status: 'warning' });
  });

  test('reaching exactly 100% is still a warning', async () => {
    const { budgetAlert } = (await add(expense(1000))).json;
    assert.deepEqual([budgetAlert.status, budgetAlert.percentUsed, budgetAlert.remaining], ['warning', 100, 0]);
  });

  test('exceeding 100% reports the excess', async () => {
    const { budgetAlert } = (await add(expense(1250.5))).json;
    assert.deepEqual([budgetAlert.status, budgetAlert.percentUsed, budgetAlert.remaining], ['exceeded', 125, -250.5]);
  });

  test('every further expense while over 80% alerts again (one alert per action)', async () => {
    await add(expense(900));
    const res = await add(expense(50));
    assert.equal(res.json.budgetAlert.status, 'warning');
    assert.equal(Object.keys(res.json).filter((k) => k.startsWith('budget')).length, 1);
  });

  test('client-supplied totals are ignored', async () => {
    const res = await add({ ...expense(10), spent: 5000, budgetAlert: { status: 'exceeded' } });
    assert.equal(res.json.budgetAlert, undefined);
  });
});

describe('unrelated activity', () => {
  test('income, other categories, other months and other students never alert', async () => {
    await add(expense(900));
    assert.equal((await add({ type: 'income', amount: 5000, category: 'Allowance', date: THIS_MONTH })).json.budgetAlert, undefined);
    assert.equal((await add(expense(9999, { category: 'Transport' }))).json.budgetAlert, undefined);
    assert.equal((await add(expense(9999, { date: LAST_MONTH }))).json.budgetAlert, undefined);
    assert.equal((await add(expense(9999), bob)).json.budgetAlert, undefined);
  });

  test('another student\'s budget is never reported to me', async () => {
    await budget('Study', 10, bob);
    assert.equal((await add(expense(999, { category: 'Study' }))).json.budgetAlert, undefined);
  });

  test('a budget alert is not repeated by reads', async () => {
    await add(expense(1200));
    const res = await app.request('GET', '/api/transactions', { cookie: alice });
    assert.equal(res.json.budgetAlert, undefined);
  });
});

describe('editing and deleting', () => {
  test('raising an expense across 80% alerts', async () => {
    const t = (await add(expense(100))).json.transaction;
    const res = await edit(t.id, expense(850));
    assert.equal(res.json.budgetAlert.status, 'warning');
  });

  test('raising it past 100% reports exceeded', async () => {
    const t = (await add(expense(100))).json.transaction;
    assert.equal((await edit(t.id, expense(1100))).json.budgetAlert.status, 'exceeded');
  });

  test('lowering an expense, or editing only its description, does not alert', async () => {
    const t = (await add(expense(1200))).json.transaction;
    assert.equal((await edit(t.id, expense(1200, { description: 'renamed' }))).json.budgetAlert, undefined);
    assert.equal((await edit(t.id, expense(900))).json.budgetAlert, undefined);
  });

  test('moving an expense into a budgeted category alerts for the new category only', async () => {
    await add(expense(20));
    const t = (await add(expense(950, { category: 'Transport' }))).json.transaction;
    const res = await edit(t.id, expense(950));
    assert.deepEqual([res.json.budgetAlert.category, res.json.budgetAlert.status], ['Food', 'warning']);
  });

  test('moving an expense out of the budgeted category does not alert', async () => {
    const t = (await add(expense(950))).json.transaction;
    assert.equal((await edit(t.id, expense(950, { category: 'Transport' }))).json.budgetAlert, undefined);
  });

  test('moving an old expense into this month alerts; moving it out does not', async () => {
    const t = (await add(expense(900, { date: LAST_MONTH }))).json.transaction;
    assert.equal((await edit(t.id, expense(900))).json.budgetAlert.status, 'warning');
    assert.equal((await edit(t.id, expense(900, { date: LAST_MONTH }))).json.budgetAlert, undefined);
  });

  test('turning an expense into income does not alert', async () => {
    const t = (await add(expense(900))).json.transaction;
    const res = await edit(t.id, { type: 'income', amount: 900, category: 'Allowance', date: THIS_MONTH });
    assert.equal(res.json.budgetAlert, undefined);
  });

  test('deleting never alerts and the Budgets data updates', async () => {
    const t = (await add(expense(1200))).json.transaction;
    const del = await app.request('DELETE', `/api/transactions/${t.id}`, { cookie: alice });
    assert.deepEqual(Object.keys(del.json), ['message']);
    assert.equal((await app.request('GET', '/api/budgets', { cookie: alice })).json.budgets[0].spent, 0);
  });
});

describe('failures', () => {
  test('if the budget check fails the transaction is still saved and the response says the status is unknown', async () => {
    app.control.failBudgets = true;
    const res = await add(expense(900));
    assert.equal(res.status, 201);
    assert.equal(res.json.budgetCheckFailed, true);
    assert.equal(res.json.budgetAlert, undefined);
    assert.equal(app.transactions.size, 1);
  });

  test('a failed edit of someone else\'s transaction still returns 404 with no alert', async () => {
    const t = (await add(expense(100))).json.transaction;
    const res = await edit(t.id, expense(990), bob);
    assert.equal(res.status, 404);
    assert.equal(res.json.budgetAlert, undefined);
  });
});
