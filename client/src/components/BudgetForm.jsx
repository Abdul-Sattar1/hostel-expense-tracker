import Alert from './Alert.jsx';
import Field from './Field.jsx';
import useForm from '../hooks/useForm.js';
import { CATEGORIES } from '../utils/categories.js';

const AMOUNT = /^\d+(\.\d{1,2})?$/;

const validate = (v) => ({
  category: CATEGORIES.expense.includes(v.category) ? '' : 'Choose a category.',
  limit: !v.limit.trim() ? 'Enter a monthly limit.' : !AMOUNT.test(v.limit.trim()) ? 'Use digits with at most 2 decimals, like 5000 or 5000.50.' : Number(v.limit) <= 0 ? 'Limit must be greater than zero.' : '',
});

// Mount with key={id} so each edit starts from that budget's values. `taken` = categories that already have a budget.
export default function BudgetForm({ budget, taken, onSave, onCancel }) {
  const form = useForm(budget ? { category: budget.category, limit: String(budget.limit) } : { category: '', limit: '' }, validate);
  const categories = CATEGORIES.expense.filter((c) => c === budget?.category || !taken.includes(c));

  return (
    <form className="form card tx-form" onSubmit={form.handleSubmit((v) => onSave({ category: v.category, limit: Number(v.limit) }))} noValidate aria-labelledby="budget-form-title">
      <h2 id="budget-form-title" className="span-2">{budget ? 'Edit budget' : 'Add budget'}</h2>
      {form.formError && <div className="span-2"><Alert tone="error" role="alert">{form.formError}</Alert></div>}
      <Field as="select" label="Expense category" {...form.bind('category')}>
        <option value="">Choose…</option>
        {categories.map((c) => <option key={c}>{c}</option>)}
      </Field>
      <Field label="Monthly limit (Rs)" inputMode="decimal" autoComplete="off" {...form.bind('limit')} />
      <div className="form-actions span-2">
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>{form.submitting ? 'Saving…' : budget ? 'Save changes' : 'Add budget'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={form.submitting}>Cancel</button>
      </div>
    </form>
  );
}
