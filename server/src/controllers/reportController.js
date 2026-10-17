import Transaction from '../models/Transaction.js';
import { chartData } from '../services/analytics.js';
import { toCsv, toPdf } from '../services/exports.js';
import { totals } from '../services/totals.js';
import { budgetStatuses } from './budgetController.js';
import { newestFirst } from './transactionController.js';

const day = (d) => d.toISOString().slice(0, 10);

// One query for the report and both exports: the authenticated student's transactions inside the
// validated period. No pagination, so every matching record is included.
async function build(req) {
  const { start, end, label, tag } = req.filter;
  const query = { owner: req.user.id };
  if (start) query.date = { $gte: start, $lt: end };
  const transactions = (await Transaction.find(query).sort(newestFirst)).map((t) => t.toJSON());
  const range = start ? `${day(start)} to ${day(new Date(end.getTime() - 86400000))}` : null;
  return { period: { label, tag, range }, totals: totals(transactions), transactions };
}

// Budgets are monthly limits and budget spending is the current month's, so progress is only
// offered when the selected period is exactly the current month.
const isCurrentMonth = (tag) => tag === new Date().toISOString().slice(0, 7);

const download = (res, type, tag, ext, body) => {
  res.set({ 'Content-Type': type, 'Content-Disposition': `attachment; filename="hostel-expense-report-${tag}.${ext}"` });
  res.send(body);
};

export const report = async (req, res) => {
  const data = await build(req);
  res.json({
    ...data,
    charts: chartData(data.transactions, req.filter),
    budgets: isCurrentMonth(req.filter.tag) ? await budgetStatuses(req.user.id) : null,
  });
};

export const csv = async (req, res) => {
  const data = await build(req);
  download(res, 'text/csv; charset=utf-8', data.period.tag, 'csv', toCsv(data));
};

// Name and email come from the authenticated user record, never from the request.
export const pdf = async (req, res) => {
  const data = await build(req);
  const student = { name: req.user.name, email: req.user.email };
  download(res, 'application/pdf', data.period.tag, 'pdf', await toPdf({ ...data, student, budgets: await budgetStatuses(req.user.id) }));
};
