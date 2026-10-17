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
// Inserts straight into the fake store (same shape the model uses) so large data sets are cheap.
const seed = (owner, rows) => {
  for (const r of rows) {
    const id = crypto.randomBytes(12).toString('hex');
    app.transactions.set(id, { id, owner, type: 'expense', category: 'Food', description: '', ...r, date: new Date(`${r.date}T00:00:00Z`) });
  }
};
const get = (path, cookie = alice) => app.request('GET', `/api/reports${path}`, { cookie });
const dates = (res) => res.json.transactions.map((t) => t.date).sort();

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

const BOUNDARY = ['2025-12-31', '2026-01-01', '2026-01-31', '2026-02-01', '2026-12-31', '2027-01-01'];

describe('filters', () => {
  beforeEach(() => seed(aliceId, BOUNDARY.map((date) => ({ date, amount: 10 }))));

  test('month: first and last day included, neighbours excluded', async () => {
    const res = await get('?period=month&month=2026-01');
    assert.equal(res.status, 200);
    assert.deepEqual(dates(res), ['2026-01-01', '2026-01-31']);
    assert.equal(res.json.period.label, 'January 2026');
  });

  test('month: February in a leap and a non-leap year', async () => {
    seed(aliceId, [{ date: '2024-02-29', amount: 1 }, { date: '2024-03-01', amount: 1 }, { date: '2026-02-28', amount: 1 }]);
    assert.deepEqual(dates(await get('?period=month&month=2024-02')), ['2024-02-29']);
    assert.deepEqual(dates(await get('?period=month&month=2026-02')), ['2026-02-01', '2026-02-28']);
  });

  test('year: 1 January to 31 December inclusive', async () => {
    assert.deepEqual(dates(await get('?period=year&year=2026')), ['2026-01-01', '2026-01-31', '2026-02-01', '2026-12-31']);
  });

  test('custom range is inclusive at both ends, and a single day works', async () => {
    assert.deepEqual(dates(await get('?period=custom&from=2026-01-31&to=2026-02-01')), ['2026-01-31', '2026-02-01']);
    assert.deepEqual(dates(await get('?period=custom&from=2026-01-31&to=2026-01-31')), ['2026-01-31']);
  });

  test('all records returns everything', async () => {
    const res = await get('?period=all');
    assert.equal(res.json.totals.count, BOUNDARY.length);
    assert.equal(res.json.period.label, 'All records');
  });

  test('an empty period is a valid report with zero totals', async () => {
    const res = await get('?period=month&month=2030-05');
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.totals, { income: 0, expenses: 0, balance: 0, savingsPercent: null, count: 0 });
    assert.deepEqual(res.json.transactions, []);
  });
});

describe('totals', () => {
  test('are exact, split by type, and match the dashboard summary', async () => {
    seed(aliceId, [
      { type: 'income', category: 'Allowance', amount: 40000.1, date: '2026-10-01' },
      { amount: 0.1, date: '2026-10-02' },
      { amount: 0.2, date: '2026-10-03' },
      { amount: 3200.5, date: '2026-10-04' },
    ]);
    const res = await get('?period=all');
    assert.deepEqual(res.json.totals, { income: 40000.1, expenses: 3200.8, balance: 36799.3, savingsPercent: 92, count: 4 });
    const summary = (await app.request('GET', '/api/transactions/summary', { cookie: alice })).json;
    assert.deepEqual([summary.totalIncome, summary.totalExpenses, summary.balance, summary.count], [40000.1, 3200.8, 36799.3, 4]);
  });

  test('a negative balance is reported as negative', async () => {
    seed(aliceId, [{ amount: 50, date: '2026-10-02' }]);
    assert.equal((await get('?period=all')).json.totals.balance, -50);
  });

  test('only the logged-in student\'s records count, in the report and both exports', async () => {
    seed(aliceId, [{ amount: 10, description: 'mine', date: '2026-10-02' }]);
    seed(bobId, [{ amount: 999, description: 'bobs-secret', date: '2026-10-02' }]);
    const json = await get('?period=all');
    assert.deepEqual([json.json.totals.count, json.json.totals.expenses], [1, 10]);
    assert.ok(!json.text.includes('bobs-secret'));
    const csv = await get('/export.csv?period=all');
    assert.ok(!csv.text.includes('bobs-secret') && csv.text.includes('mine'));
    const pdf = await get('/export.pdf?period=all');
    assert.ok(!pdf.buffer.toString('latin1').includes(Buffer.from('bobs-secret').toString('hex')));
  });

  test('ignores a client-supplied owner id', async () => {
    seed(bobId, [{ amount: 5, date: '2026-10-02' }]);
    assert.equal((await get(`?period=all&owner=${bobId}&userId=${bobId}`)).json.totals.count, 0);
  });
});

describe('validation', () => {
  const bad = {
    'missing period': '',
    'unknown period': '?period=week',
    'repeated period': '?period=all&period=year',
    'month without value': '?period=month',
    'month 13': '?period=month&month=2026-13',
    'month 00': '?period=month&month=2026-00',
    'month wrong format': '?period=month&month=10-2026',
    'month out of range': '?period=month&month=1999-12',
    'year without value': '?period=year',
    'year text': '?period=year&year=abcd',
    'year too early': '?period=year&year=1999',
    'year too late': '?period=year&year=2101',
    'custom without dates': '?period=custom',
    'custom missing end': '?period=custom&from=2026-01-01',
    'custom impossible date': '?period=custom&from=2026-02-30&to=2026-03-01',
    'custom reversed': '?period=custom&from=2026-02-01&to=2026-01-31',
  };
  for (const [label, qs] of Object.entries(bad)) {
    test(`rejects ${label} on the report and both exports`, async () => {
      for (const path of ['', '/export.csv', '/export.pdf']) {
        const res = await get(path + qs);
        assert.equal(res.status, 400, path + qs);
        assert.ok(Object.keys(res.json.errors).length > 0);
      }
    });
  }

  test('requires authentication on every endpoint', async () => {
    seed(aliceId, [{ amount: 10, date: '2026-10-02' }]);
    for (const path of ['', '/export.csv', '/export.pdf']) {
      const res = await app.request('GET', `/api/reports${path}?period=all`);
      assert.equal(res.status, 401, path);
      assert.doesNotMatch(res.text, /Food|Hostel/);
    }
  });

  test('returns 503 when the database is unavailable', async () => {
    app.control.db = 'disconnected';
    for (const path of ['', '/export.csv', '/export.pdf']) assert.equal((await get(`${path}?period=all`)).status, 503, path);
  });

  test('reports never modify transactions', async () => {
    seed(aliceId, [{ amount: 10, date: '2026-10-02' }]);
    const before = JSON.stringify([...app.transactions.values()]);
    for (const path of ['', '/export.csv', '/export.pdf']) await get(`${path}?period=all`);
    assert.equal(JSON.stringify([...app.transactions.values()]), before);
  });
});

describe('CSV export', () => {
  test('has download headers, a period filename, summary block, header row and amounts', async () => {
    seed(aliceId, [
      { type: 'income', category: 'Allowance', amount: 1000, description: 'Pocket money', date: '2026-10-01' },
      { amount: 250.5, description: 'Mess bill', date: '2026-10-12' },
    ]);
    const res = await get('/export.csv?period=month&month=2026-10');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/csv/);
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="hostel-expense-report-2026-10.csv"');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const lines = res.text.replace(/^﻿/, '').split('\r\n');
    assert.deepEqual(lines.slice(0, 2), ['Report,Hostel Expense Tracker', 'Period,October 2026']);
    assert.ok(lines.includes('Total income,1000.00') && lines.includes('Total expenses,250.50') && lines.includes('Net balance,749.50') && lines.includes('Transactions,2'));
    const at = lines.indexOf('Date,Type,Category,Description,Amount (Rs)');
    assert.ok(at > 0);
    assert.deepEqual(lines.slice(at + 1, at + 3), ['2026-10-12,Expense,Food,Mess bill,250.50', '2026-10-01,Income,Allowance,Pocket money,1000.00']);
  });

  test('filenames reflect year, custom range and all records', async () => {
    const name = async (qs) => (await get(`/export.csv${qs}`)).headers.get('content-disposition');
    assert.match(await name('?period=year&year=2026'), /report-2026\.csv/);
    assert.match(await name('?period=custom&from=2026-01-01&to=2026-03-31'), /report-2026-01-01_to_2026-03-31\.csv/);
    assert.match(await name('?period=all'), /report-all\.csv/);
  });

  test('escapes commas, quotes and newlines', async () => {
    seed(aliceId, [{ amount: 1, description: 'tea, "chai"\nand biscuits', date: '2026-10-02' }]);
    const res = await get('/export.csv?period=all');
    assert.ok(res.text.includes('"tea, ""chai""\nand biscuits"'));
  });

  test('neutralises spreadsheet formulas in text fields', async () => {
    const evil = ['=HYPERLINK("http://evil.example")', '+1+1', '-2+3', '@SUM(A1)', '\t=1+1', '=1+1,2'];
    seed(aliceId, evil.map((description, i) => ({ amount: 1, description, date: `2026-10-0${i + 1}` })));
    const res = await get('/export.csv?period=all');
    const rows = res.text.split('\r\n').filter((l) => l.startsWith('2026-10-'));
    assert.equal(rows.length, evil.length);
    for (const row of rows) {
      const description = row.split(',Expense,Food,')[1];
      assert.match(description, /^"?'/, row);
      assert.doesNotMatch(description, /^"?[=+\-@]/, row);
    }
  });

  test('also protects the category and the period fields', async () => {
    seed(aliceId, [{ amount: 1, category: '=cmd|calc', date: '2026-10-02' }]);
    const res = await get('/export.csv?period=all');
    assert.ok(res.text.includes(",'=cmd|calc,"));
  });

  test('contains every matching record, far beyond any page size', async () => {
    seed(aliceId, Array.from({ length: 1234 }, (_, i) => ({ amount: 1, description: `item-${i}`, date: '2026-10-02' })));
    const res = await get('/export.csv?period=month&month=2026-10');
    const rows = res.text.split('\r\n').filter((l) => l.includes(',Expense,Food,item-'));
    assert.equal(rows.length, 1234);
    assert.ok(res.text.includes('Transactions,1234'));
  });

  test('an empty report still has the summary and header', async () => {
    const res = await get('/export.csv?period=all');
    assert.ok(res.text.includes('Transactions,0') && res.text.includes('Date,Type,Category,Description,Amount (Rs)'));
  });
});

// With NODE_ENV=test the PDF is uncompressed; pdfkit writes each string as <hex> chunks (split by
// kerning) inside a TJ array, so chunks of one array are joined back into the original text.
const pdfText = (buffer) => [...buffer.toString('latin1').matchAll(/\[([^\]]*)\] TJ/g)]
  .map((m) => [...m[1].matchAll(/<([0-9a-f]+)>/g)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join(''));
const pages = (buffer) => (buffer.toString('latin1').match(/\/Type \/Page(?![s\w])/g) ?? []).length;

describe('PDF export', () => {
  test('is a PDF download named for the period, with title, period, date and summary', async () => {
    seed(aliceId, [
      { type: 'income', category: 'Allowance', amount: 1000, description: 'Pocket money', date: '2026-10-01' },
      { amount: 250.5, description: 'Mess bill', date: '2026-10-12' },
    ]);
    const res = await get('/export.pdf?period=month&month=2026-10');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="hostel-expense-report-2026-10.pdf"');
    assert.equal(res.buffer.subarray(0, 5).toString(), '%PDF-');
    const text = pdfText(res.buffer);
    for (const expected of ['Hostel Expense Tracker', 'October 2026', '2026-10-01 to 2026-10-31', '+Rs 1,000.00', '-Rs 250.50', 'Rs 749.50', 'Mess bill', 'Pocket money']) {
      assert.ok(text.includes(expected), expected);
    }
    assert.ok(text.includes('TRANSACTIONS') || text.includes('Transactions'));
    assert.ok(text.some((t) => /^\d{4}-\d{2}-\d{2} \(Pakistan time, Asia\/Karachi\)$/.test(t)));
  });

  test('has the branded header, institution details, student identity and exact footer on every page', async () => {
    seed(aliceId, Array.from({ length: 120 }, (_, i) => ({ amount: 1, description: `entry-${i}`, date: '2026-10-02' })));
    const res = await get('/export.pdf?period=all');
    const text = pdfText(res.buffer);
    const pageCount = pages(res.buffer);
    assert.ok(pageCount >= 2);
    for (const expected of ['Hostel Expense Tracker', 'Expense and Budget Report', 'Mehran University of Engineering and Technology (MUET)', 'SZAB Campus Khairpur Mirs', 'Department of Software Engineering', 'Alice Khan', 'alice@example.com', 'All records', 'All dates']) {
      assert.ok(text.includes(expected), expected);
    }
    const credit = 'Developed by : K22SW012,X-50 & 10';
    const copyright = '© 2026 Department of Software Engineering, MUET SZAB Campus Khairpur Mirs. All rights reserved.';
    assert.equal(text.filter((t) => t === credit).length, pageCount);
    assert.equal(text.filter((t) => t === copyright).length, pageCount);
    for (let i = 1; i <= pageCount; i++) assert.ok(text.includes(`Page ${i} of ${pageCount}`), `page ${i}`);
  });

  test('uses the logged-in student\'s own identity, never one supplied by the client', async () => {
    const res = await get('/export.pdf?period=all&name=Mallory&email=mallory@example.com', bob);
    const text = pdfText(res.buffer);
    assert.ok(text.includes('Bob Shah') && text.includes('bob@example.com'));
    assert.ok(!text.includes('Mallory') && !text.includes('Alice Khan'));
  });

  test('shows this month\'s budget status from real budgets, or says none are set', async () => {
    assert.ok(pdfText((await get('/export.pdf?period=all')).buffer).includes('No monthly budgets are set.'));
    await app.request('POST', '/api/budgets', { body: { category: 'Food', limit: 1000 }, cookie: alice });
    const thisMonth = new Date().toISOString().slice(0, 8) + '01';
    seed(aliceId, [{ amount: 1200, date: thisMonth }]);
    const text = pdfText((await get('/export.pdf?period=all')).buffer);
    assert.ok(!text.includes('No monthly budgets are set.'));
    for (const expected of ['Food', 'Rs 1,000.00', 'Rs 1,200.00', '-Rs 200.00', '120%', 'Over budget']) assert.ok(text.includes(expected), expected);
  });

  test('contains every record across many pages and repeats the table header on each page', async () => {
    seed(aliceId, Array.from({ length: 300 }, (_, i) => ({ amount: i + 1, description: `entry-${i}`, date: '2026-10-02' })));
    const res = await get('/export.pdf?period=all');
    const text = pdfText(res.buffer);
    for (let i = 0; i < 300; i++) assert.ok(text.includes(`entry-${i}`), `entry-${i}`);
    const pageCount = pages(res.buffer);
    assert.ok(pageCount >= 5, `pages: ${pageCount}`);
    assert.equal(text.filter((t) => t === 'Description').length, pageCount);
    assert.ok(text.includes('300'));
  });

  test('handles very long descriptions and unbroken strings', async () => {
    seed(aliceId, [
      { amount: 1, description: 'word '.repeat(40).trim(), date: '2026-10-02' },
      { amount: 2, description: 'x'.repeat(200), date: '2026-10-03' },
    ]);
    const res = await get('/export.pdf?period=all');
    assert.equal(res.status, 200);
    assert.equal(res.buffer.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdfText(res.buffer).join('').includes('x'.repeat(20)));
  });

  test('an empty period says so', async () => {
    const res = await get('/export.pdf?period=month&month=2030-05');
    assert.equal(res.status, 200);
    assert.ok(pdfText(res.buffer).includes('No transactions match this period.'));
  });
});
