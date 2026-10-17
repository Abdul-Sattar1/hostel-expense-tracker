import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import BudgetForm from '../../components/BudgetForm.jsx';
import Icon from '../../components/Icon.jsx';
import usePageTitle from '../../hooks/usePageTitle.js';
import { formatMoney } from '../../utils/format.js';

const STATUS = {
  ok: ['bar-ok', 'status-ok', 'check', 'On track'],
  warning: ['bar-warn', 'status-warn', 'alert', 'Approaching limit'],
  exceeded: ['bar-bad', 'status-bad', 'alert', 'Over budget'],
};

function BudgetCard({ b, busy, onEdit, onDelete }) {
  const [bar, tone, icon, label] = STATUS[b.status];
  return (
    <li className="card budget-card">
      <div className="budget-head">
        <strong>{b.category}</strong>
        <span className={`status ${tone}`}><Icon name={icon} size={16} />{label}</span>
      </div>
      <div className="meter" role="progressbar" aria-label={`${b.category} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(b.percentUsed, 100)} aria-valuetext={`${b.percentUsed}% used`}>
        <span className={bar} style={{ width: `${Math.min(b.percentUsed, 100)}%` }} />
      </div>
      <p className="budget-line"><span>{b.percentUsed}% used</span><span>{formatMoney(b.spent)} of {formatMoney(b.limit)}</span></p>
      {b.status === 'exceeded' && <Alert tone="error" role="alert">Over budget by {formatMoney(-b.remaining)} this month.</Alert>}
      {b.status === 'warning' && <Alert tone="warning" role="status">{b.remaining === 0 ? 'You have used your whole budget.' : `Only ${formatMoney(b.remaining)} left this month.`}</Alert>}
      {b.status === 'ok' && <p className="muted budget-left">{formatMoney(b.remaining)} remaining this month</p>}
      <div className="tx-actions">
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(b)} disabled={busy}>Edit</button>
        <button type="button" className="btn btn-secondary" onClick={() => onDelete(b)} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
      </div>
    </li>
  );
}

export default function Budgets() {
  usePageTitle('Budgets');
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, budget = edit
  const [notice, setNotice] = useState({ tone: 'success', text: '' });
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoadError('');
    api('/budgets').then((d) => setItems(d.budgets), (err) => setLoadError(err.message));
  };
  useEffect(load, []);

  const open = (record) => {
    setNotice({ tone: 'success', text: '' });
    setEditing(record);
  };

  const save = async (body) => {
    const edit = editing.id;
    await api(edit ? `/budgets/${edit}` : '/budgets', { method: edit ? 'PATCH' : 'POST', body });
    setEditing(null);
    setNotice({ tone: 'success', text: edit ? 'Budget updated.' : 'Budget added.' });
    load();
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete the ${b.category} budget of Rs ${b.limit}? Your transactions are not affected.`)) return;
    setBusyId(b.id);
    try {
      await api(`/budgets/${b.id}`, { method: 'DELETE' });
      setNotice({ tone: 'success', text: 'Budget deleted.' });
      load();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Budgets</h1>
        {!editing && <button type="button" className="btn btn-primary" onClick={() => open({})}>Add budget</button>}
      </div>
      <p className="lead">A monthly limit for an expense category. Spending is counted from your transactions for the current month.</p>
      {notice.text && <Alert tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</Alert>}
      {editing && <BudgetForm key={editing.id ?? 'new'} budget={editing.id ? editing : null} taken={(items ?? []).map((b) => b.category)} onSave={save} onCancel={() => setEditing(null)} />}
      {loadError ? (
        <Alert tone="error" role="alert">{loadError} <button type="button" className="btn btn-secondary" onClick={load}>Try again</button></Alert>
      ) : !items ? (
        <div className="page-loading" role="status" aria-label="Loading budgets"><span className="spinner" /></div>
      ) : items.length === 0 ? (
        <Alert>You have no budgets yet. Use “Add budget” to set a monthly limit for a category such as Food.</Alert>
      ) : (
        <ul className="budget-list">
          {items.map((b) => <BudgetCard key={b.id} b={b} busy={busyId === b.id} onEdit={open} onDelete={remove} />)}
        </ul>
      )}
    </>
  );
}
