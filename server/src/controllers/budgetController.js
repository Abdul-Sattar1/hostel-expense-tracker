import { HttpError } from '../middleware/error.js';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';

const cents = (n) => Math.round(n * 100);

// Whole paisa per expense category for the current calendar month (UTC, like stored dates).
async function spentByCategory(owner) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const rows = await Transaction.find({ owner, type: 'expense', date: { $gte: start, $lt: end } });
  const spent = {};
  for (const t of rows) spent[t.category] = (spent[t.category] ?? 0) + cents(t.amount);
  return spent;
}

function present(budget, spent) {
  const limit = cents(budget.limit);
  const used = spent[budget.category] ?? 0;
  return {
    id: budget.id,
    category: budget.category,
    limit: limit / 100,
    spent: used / 100,
    remaining: (limit - used) / 100,
    percentUsed: Math.round((used * 100) / limit),
    status: used > limit ? 'exceeded' : used * 100 >= limit * 80 ? 'warning' : 'ok',
  };
}

// Runs a transaction write and reports the one budget it pushed to 80% or more, if any. A budget is
// only reported when this write increased its category's spending, so edits that lower spending,
// deletes, income and unrelated categories (or dates outside this month) never notify, and a
// single write can raise at most one category. If the budget check fails the write still stands
// and `budgetCheckFailed` tells the client the status is unknown.
export async function withBudgetAlert(owner, relevant, action) {
  if (!relevant) return { result: await action() };
  let before = null;
  try {
    before = await spentByCategory(owner);
  } catch { /* reported below */ }
  const result = await action();
  if (!before) return { result, budgetCheckFailed: true };
  try {
    const after = await spentByCategory(owner);
    const raised = Object.keys(after).filter((c) => after[c] > (before[c] ?? 0));
    if (!raised.length) return { result };
    const budgets = await Budget.find({ owner }).sort({ category: 1 });
    const hit = budgets.filter((b) => raised.includes(b.category)).map((b) => present(b, after)).find((b) => b.status !== 'ok');
    return hit ? { result, budgetAlert: hit } : { result };
  } catch {
    return { result, budgetCheckFailed: true };
  }
}

const orNotFound =(doc) => {
  if (!doc) throw new HttpError(404, 'Budget not found.');
  return doc;
};

// Unique index on (owner, category): a second budget for the same category is a conflict.
const onDuplicate = (err) => {
  if (err.code === 11000) throw new HttpError(409, 'You already have a budget for this category. Edit it instead.');
  throw err;
};

// Every query filters by owner = the authenticated user, so another student's budget is a 404.
// Every budget with this month's spending (also used by the PDF report).
export async function budgetStatuses(owner) {
  const [budgets, spent] = await Promise.all([Budget.find({ owner }).sort({ category: 1 }), spentByCategory(owner)]);
  return budgets.map((b) => present(b, spent));
}

export const list = async (req, res) => res.json({ budgets: await budgetStatuses(req.user.id) });

export const get = async (req, res) => {
  const budget = orNotFound(await Budget.findOne({ _id: req.params.id, owner: req.user.id }));
  res.json({ budget: present(budget, await spentByCategory(req.user.id)) });
};

export const create = async (req, res) => {
  const budget = await Budget.create({ ...req.body, owner: req.user.id }).catch(onDuplicate);
  res.status(201).json({ budget: present(budget, await spentByCategory(req.user.id)) });
};

export const update = async (req, res) => {
  const budget = await Budget.findOneAndUpdate({ _id: req.params.id, owner: req.user.id }, req.body, { new: true, runValidators: true }).catch(onDuplicate);
  res.json({ budget: present(orNotFound(budget), await spentByCategory(req.user.id)) });
};

export const remove = async (req, res) => {
  orNotFound(await Budget.findOneAndDelete({ _id: req.params.id, owner: req.user.id }));
  res.json({ message: 'Budget deleted.' });
};
