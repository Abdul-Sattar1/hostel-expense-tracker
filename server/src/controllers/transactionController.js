import { HttpError } from '../middleware/error.js';
import Transaction from '../models/Transaction.js';
import { totals } from '../services/totals.js';
import { withBudgetAlert } from './budgetController.js';

// Every query below filters by owner = the authenticated user, so another student's record
// is indistinguishable from a missing one (404).
export function checkId(req, _res, next, id) {
  if (!/^[a-f\d]{24}$/i.test(id)) return next(new HttpError(400, 'Invalid transaction id.'));
  next();
}

const orNotFound = (doc) => {
  if (!doc) throw new HttpError(404, 'Transaction not found.');
  return doc;
};

export const newestFirst = { date: -1, createdAt: -1 };

export const list = async (req, res) => {
  res.json({ transactions: await Transaction.find({ owner: req.user.id }).sort(newestFirst) });
};

export const get = async (req, res) => {
  res.json({ transaction: orNotFound(await Transaction.findOne({ _id: req.params.id, owner: req.user.id })) });
};

// Responses to create/update also carry the budget notification computed on the server, if any.
export const create = async (req, res) => {
  const { result, ...budget } = await withBudgetAlert(req.user.id, req.body.type === 'expense', () => Transaction.create({ ...req.body, owner: req.user.id }));
  res.status(201).json({ transaction: result, ...budget });
};

export const update = async (req, res) => {
  const { result, ...budget } = await withBudgetAlert(req.user.id, req.body.type === 'expense', async () =>
    orNotFound(await Transaction.findOneAndUpdate({ _id: req.params.id, owner: req.user.id }, req.body, { new: true, runValidators: true })));
  res.json({ transaction: result, ...budget });
};

export const remove = async (req, res) => {
  orNotFound(await Transaction.findOneAndDelete({ _id: req.params.id, owner: req.user.id }));
  res.json({ message: 'Transaction deleted.' });
};

export const summary = async (req, res) => {
  const all = await Transaction.find({ owner: req.user.id }).sort(newestFirst);
  const { income, expenses, balance, count } = totals(all);
  res.json({ totalIncome: income, totalExpenses: expenses, balance, count, recent: all.slice(0, 5) });
};
