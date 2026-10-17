import crypto from 'node:crypto';
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
const seed = (owner, rows) => {
  for (const r of rows) {
    const id = crypto.randomBytes(12).toString('hex');
    app.transactions.set(id, { id, owner, type: 'expense', category: 'Food', description: '', ...r, date: new Date(`${r.date}T00:00:00Z`) });
  }
};
const get = async (qs, cookie = alice) => (await app.request('GET', `/api/reports${qs}`, { cookie })).json;
const income = (amount, date, category = 'Allowance') => ({ type: 'income', category, amount, date });
const spend = (amount, date, category = 'Food') => ({ amount, date, category });

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

describe('summary figures', () => {
  test('savings percentage = (income - expenses) / income', async () => {
    seed(aliceId, [income(1000, '2026-10-01'), spend(250, '2026-10-02')]);
    const { totals } = await get('?period=all');
    assert.deepEqual([totals.balance, totals.savingsPercent], [750, 75]);
  });

  test('is null with zero income (never NaN or Infinity) and negative when overspending', async () => {
    seed(aliceId, [spend(250, '2026-10-02')]);
    assert.equal((await get('?period=all')).totals.savingsPercent, null);
    seed(aliceId, [income(100, '2026-10-01')]);
    assert.equal((await get('?period=all')).totals.savingsPercent, -150);
  });

  test('is exact for awkward decimals', async () => {
    seed(aliceId, [income(300, '2026-10-01'), spend(0.1, '2026-10-02'), spend(0.2, '2026-10-02')]);
    const { totals } = await get('?period=all');
    assert.deepEqual([totals.expenses, totals.savingsPercent], [0.3, 99.9]);
  });
});

describe('category aggregation', () => {
  test('groups expenses and income by category with exact shares, largest first', async () => {
    seed(aliceId, [
      spend(300, '2026-10-01', 'Food'), spend(100.5, '2026-10-02', 'Food'),
      spend(100, '2026-10-03', 'Transport'), spend(99.5, '2026-10-04', 'Study'),
      income(900, '2026-10-01', 'Allowance'), income(100, '2026-10-02', 'Scholarship'),
    ]);
    const { charts } = await get('?period=month&month=2026-10');
    assert.deepEqual(charts.expensesByCategory, [
      { category: 'Food', amount: 400.5, percent: 80.1 },
      { category: 'Transport', amount: 100, percent: 20 },
      { category: 'Study', amount: 99.5, percent: 19.9 },
    ].map((c, _, all) => ({ ...c, percent: Math.round((c.amount * 1000) / 600) / 10 })));
    assert.deepEqual(charts.incomeByCategory, [{ category: 'Allowance', amount: 900, percent: 90 }, { category: 'Scholarship', amount: 100, percent: 10 }]);
  });

  test('expense amounts add up to the report total', async () => {
    seed(aliceId, [spend(10.1, '2026-10-01', 'Food'), spend(20.2, '2026-10-01', 'Study'), spend(0.3, '2026-10-02', 'Health')]);
    const { charts, totals } = await get('?period=all');
    assert.equal(Math.round(charts.expensesByCategory.reduce((s, c) => s + c.amount * 100, 0)), totals.expenses * 100);
  });

  test('only covers the selected period', async () => {
    seed(aliceId, [spend(100, '2026-10-01'), spend(900, '2026-09-30', 'Study')]);
    assert.deepEqual((await get('?period=month&month=2026-10')).charts.expensesByCategory.map((c) => c.category), ['Food']);
  });

  test('empty periods give empty lists', async () => {
    const { charts } = await get('?period=month&month=2030-01');
    assert.deepEqual([charts.incomeByCategory, charts.expensesByCategory], [[], []]);
  });
});

describe('income vs expense series', () => {
  test('month: one zero-filled point per day', async () => {
    seed(aliceId, [income(500, '2026-02-01'), spend(20, '2026-02-01'), spend(30, '2026-02-28'), spend(99, '2026-03-01')]);
    const { series } = (await get('?period=month&month=2026-02')).charts;
    assert.equal(series.unit, 'day');
    assert.equal(series.points.length, 28);
    assert.deepEqual(series.points[0], { key: '2026-02-01', income: 500, expenses: 20 });
    assert.deepEqual(series.points[27], { key: '2026-02-28', income: 0, expenses: 30 });
    assert.deepEqual(series.points[10], { key: '2026-02-11', income: 0, expenses: 0 });
  });

  test('leap February has 29 days', async () => {
    assert.equal((await get('?period=month&month=2028-02')).charts.series.points.length, 29);
  });

  test('year: twelve monthly points that sum each month', async () => {
    seed(aliceId, [income(100, '2026-01-01'), income(50, '2026-01-31'), spend(10, '2026-01-15'), spend(5, '2026-12-31'), spend(999, '2027-01-01')]);
    const { series } = (await get('?period=year&year=2026')).charts;
    assert.equal(series.unit, 'month');
    assert.deepEqual(series.points.map((p) => p.key), Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`));
    assert.deepEqual(series.points[0], { key: '2026-01', income: 150, expenses: 10 });
    assert.deepEqual(series.points[11], { key: '2026-12', income: 0, expenses: 5 });
  });

  test('custom: daily up to 62 days, monthly beyond, ends included', async () => {
    seed(aliceId, [spend(1, '2026-10-05'), spend(2, '2026-10-07')]);
    const short = (await get('?period=custom&from=2026-10-05&to=2026-10-07')).charts.series;
    assert.deepEqual(short.points.map((p) => [p.key, p.expenses]), [['2026-10-05', 1], ['2026-10-06', 0], ['2026-10-07', 2]]);
    const edge = (await get('?period=custom&from=2026-09-01&to=2026-11-01')).charts.series;
    assert.equal(edge.unit, 'day');
    const long = (await get('?period=custom&from=2026-09-01&to=2026-11-02')).charts.series;
    assert.deepEqual([long.unit, long.points.map((p) => p.key)], ['month', ['2026-09', '2026-10', '2026-11']]);
  });

  test('all time: spans first to last transaction; empty gives no points', async () => {
    assert.deepEqual((await get('?period=all')).charts.series.points, []);
    seed(aliceId, [spend(1, '2026-08-20'), spend(2, '2026-11-02')]);
    const { series } = (await get('?period=all')).charts;
    assert.deepEqual(series.points.map((p) => p.key), ['2026-08', '2026-09', '2026-10', '2026-11']);
    seed(aliceId, [spend(1, '2026-08-25')]);
  });

  test('all time within two months is daily', async () => {
    seed(aliceId, [spend(1, '2026-08-30'), spend(2, '2026-09-02')]);
    const { series } = (await get('?period=all')).charts;
    assert.deepEqual([series.unit, series.points.length], ['day', 4]);
  });

  test('changing the period changes every chart together', async () => {
    seed(aliceId, [income(100, '2026-01-10'), spend(40, '2026-01-11', 'Study'), spend(60, '2026-06-11', 'Food')]);
    const jan = await get('?period=month&month=2026-01');
    const year = await get('?period=year&year=2026');
    assert.deepEqual([jan.totals.expenses, year.totals.expenses], [40, 100]);
    assert.deepEqual([jan.charts.series.points.length, year.charts.series.points.length], [31, 12]);
    assert.deepEqual([jan.charts.expensesByCategory.length, year.charts.expensesByCategory.length], [1, 2]);
    assert.deepEqual([jan.transactions.length, year.transactions.length], [2, 3]);
  });
});

describe('budget progress', () => {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)).toISOString().slice(0, 7);

  test('is offered only for the current month, from the existing budget rules', async () => {
    await app.request('POST', '/api/budgets', { body: { category: 'Food', limit: 1000 }, cookie: alice });
    seed(aliceId, [spend(850, `${thisMonth}-01`)]);
    const res = await get(`?period=month&month=${thisMonth}`);
    assert.deepEqual({ ...res.budgets[0], id: undefined }, { id: undefined, category: 'Food', limit: 1000, spent: 850, remaining: 150, percentUsed: 85, status: 'warning' });
    assert.deepEqual(res.budgets, (await app.request('GET', '/api/budgets', { cookie: alice })).json.budgets);
  });

  test('is not compared against other periods', async () => {
    await app.request('POST', '/api/budgets', { body: { category: 'Food', limit: 1000 }, cookie: alice });
    for (const qs of [`?period=month&month=${lastMonth}`, `?period=year&year=${thisMonth.slice(0, 4)}`, '?period=all', `?period=custom&from=${thisMonth}-01&to=${thisMonth}-02`]) {
      assert.equal((await get(qs)).budgets, null, qs);
    }
  });

  test('an empty list when the student has no budgets', async () => {
    assert.deepEqual((await get(`?period=month&month=${thisMonth}`)).budgets, []);
  });

  test('never shows another student\'s budgets or spending', async () => {
    await app.request('POST', '/api/budgets', { body: { category: 'Study', limit: 10 }, cookie: bob });
    seed(bobId, [spend(500, `${thisMonth}-01`, 'Study')]);
    const res = await get(`?period=month&month=${thisMonth}`);
    assert.deepEqual([res.budgets, res.charts.expensesByCategory, res.totals.count], [[], [], 0]);
  });
});

describe('isolation and validation', () => {
  test('charts only contain the logged-in student\'s data', async () => {
    seed(aliceId, [spend(10, '2026-10-01', 'Food')]);
    seed(bobId, [spend(9999, '2026-10-01', 'Study'), income(5000, '2026-10-01')]);
    const { charts, totals } = await get('?period=all');
    assert.deepEqual(charts.expensesByCategory, [{ category: 'Food', amount: 10, percent: 100 }]);
    assert.deepEqual(charts.incomeByCategory, []);
    assert.equal(totals.count, 1);
  });

  test('invalid or reversed dates are rejected before any chart is built', async () => {
    for (const qs of ['?period=custom&from=2026-10-10&to=2026-10-09', '?period=custom&from=2026-02-30&to=2026-03-01', '?period=month&month=2026-13', '?period=year&year=1999']) {
      const res = await app.request('GET', `/api/reports${qs}`, { cookie: alice });
      assert.equal(res.status, 400, qs);
      assert.equal(res.json.charts, undefined);
    }
  });

  test('exports still match the report for the same period', async () => {
    seed(aliceId, [income(100, '2026-10-01'), spend(40, '2026-10-02')]);
    const csv = await app.request('GET', '/api/reports/export.csv?period=month&month=2026-10', { cookie: alice });
    const pdf = await app.request('GET', '/api/reports/export.pdf?period=month&month=2026-10', { cookie: alice });
    assert.ok(csv.text.includes('Total expenses,40.00') && csv.text.includes('Net balance,60.00'));
    assert.equal(pdf.buffer.subarray(0, 5).toString(), '%PDF-');
  });
});
