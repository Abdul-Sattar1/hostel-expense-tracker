import Alert from './Alert.jsx';
import Field from './Field.jsx';
import useForm from '../hooks/useForm.js';
import { CATEGORIES } from '../utils/categories.js';

const AMOUNT = /^\d+(\.\d{1,2})?$/;

const validate = (v) => ({
  type: '',
  amount: !v.amount.trim() ? 'Enter an amount.' : !AMOUNT.test(v.amount.trim()) ? 'Use digits with at most 2 decimals, like 450 or 450.50.' : Number(v.amount) <= 0 ? 'Amount must be greater than zero.' : '',
  category: CATEGORIES[v.type].includes(v.category) ? '' : 'Choose a category.',
  description: v.description.length > 200 ? 'Use at most 200 characters.' : '',
  date: v.date ? '' : 'Choose a date.',
});

// Mount with key={id} so each edit starts from that record's values.
export default function TransactionForm({ transaction, onSave, onCancel }) {
  const form = useForm(
    transaction
      ? { type: transaction.type, amount: String(transaction.amount), category: transaction.category, description: transaction.description, date: transaction.date }
      : { type: 'expense', amount: '', category: '', description: '', date: new Date().toLocaleDateString('en-CA') },
    validate,
  );
  const submit = (v) => onSave({ type: v.type, amount: Number(v.amount), category: v.category, description: v.description.trim(), date: v.date });

  return (
    <form className="form card tx-form" onSubmit={form.handleSubmit(submit)} noValidate aria-labelledby="tx-form-title">
      <h2 id="tx-form-title" className="span-2">{transaction ? 'Edit transaction' : 'Add transaction'}</h2>
      {form.formError && <div className="span-2"><Alert tone="error" role="alert">{form.formError}</Alert></div>}
      <Field as="select" label="Type" {...form.bind('type')} onChange={(e) => form.set({ type: e.target.value, category: '' })}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </Field>
      <Field label="Amount (Rs)" inputMode="decimal" autoComplete="off" {...form.bind('amount')} />
      <Field as="select" label="Category" {...form.bind('category')}>
        <option value="">Choose…</option>
        {CATEGORIES[form.values.type].map((c) => <option key={c}>{c}</option>)}
      </Field>
      <Field label="Date" type="date" {...form.bind('date')} />
      <div className="span-2"><Field label="Description (optional)" maxLength={200} {...form.bind('description')} /></div>
      <div className="form-actions span-2">
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>{form.submitting ? 'Saving…' : transaction ? 'Save changes' : 'Add transaction'}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={form.submitting}>Cancel</button>
      </div>
    </form>
  );
}
