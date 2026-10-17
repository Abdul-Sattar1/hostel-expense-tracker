// Chart data for a report, calculated from the same transaction rows as the totals and table
// (rows are the JSON form: date 'YYYY-MM-DD', amount in rupees). Sums use whole paisa.
const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const paisa = (t) => Math.round(t.amount * 100);

// Amount and share of the type's total per category, largest first.
function byCategory(rows, type) {
  const sums = new Map();
  let total = 0;
  for (const t of rows) {
    if (t.type !== type) continue;
    sums.set(t.category, (sums.get(t.category) ?? 0) + paisa(t));
    total += paisa(t);
  }
  return [...sums]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, p]) => ({ category, amount: p / 100, percent: Math.round((p * 1000) / total) / 10 }));
}

// Income and expenses per bucket, zero-filled across the whole period: daily for periods of up to
// 62 days (a month), otherwise monthly (a year). "All records" spans the first to the last transaction.
function timeSeries(rows, { start, end }) {
  let from = start && iso(start);
  let to = end && iso(new Date(end.getTime() - DAY));
  if (!start) {
    if (!rows.length) return { unit: 'month', points: [] };
    const dates = rows.map((t) => t.date).sort();
    from = dates[0];
    to = dates.at(-1);
  }
  const days = (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / DAY + 1;
  const unit = days <= 62 ? 'day' : 'month';
  const keyOf = (date) => (unit === 'day' ? date : date.slice(0, 7));

  const points = new Map();
  const cursor = new Date(`${unit === 'day' ? from : `${from.slice(0, 7)}-01`}T00:00:00Z`);
  const last = keyOf(to);
  for (let key = keyOf(iso(cursor)); key <= last; key = keyOf(iso(cursor))) {
    points.set(key, { key, income: 0, expenses: 0 });
    if (unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const t of rows) points.get(keyOf(t.date))[t.type === 'income' ? 'income' : 'expenses'] += paisa(t);
  return { unit, points: [...points.values()].map((p) => ({ ...p, income: p.income / 100, expenses: p.expenses / 100 })) };
}

export const chartData = (rows, range) => ({
  series: timeSeries(rows, range),
  incomeByCategory: byCategory(rows, 'income'),
  expensesByCategory: byCategory(rows, 'expense'),
});
