import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import TransactionForm from '../../components/TransactionForm.jsx';
import TransactionTable from '../../components/TransactionTable.jsx';
import usePageTitle from '../../hooks/usePageTitle.js';
import { formatMoney } from '../../utils/format.js';

export default function Transactions() {
  usePageTitle('Transactions');
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, record = edit
  const [notice, setNotice] = useState({ tone: 'success', text: '' });
  const [busyId, setBusyId] = useState(null);
  const [budget, setBudget] = useState(null); // budget notification from the last save: {alert} or {unknown}

  const load = () => {
    setLoadError('');
    api('/transactions').then((d) => setItems(d.transactions), (err) => setLoadError(err.message));
  };
  useEffect(load, []);

  const save = async (body) => {
    const edit = editing.id;
    const data = await api(edit ? `/transactions/${edit}` : '/transactions', { method: edit ? 'PATCH' : 'POST', body });
    setEditing(null);
    setBudget(data.budgetAlert ? { alert: data.budgetAlert } : data.budgetCheckFailed ? { unknown: true } : null);
    setNotice({ tone: 'success', text: edit ? 'Transaction updated.' : 'Transaction added.' });
    load();
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete this ${t.type} of Rs ${t.amount} (${t.category})? This cannot be undone.`)) return;
    setBusyId(t.id);
    try {
      await api(`/transactions/${t.id}`, { method: 'DELETE' });
      setNotice({ tone: 'success', text: 'Transaction deleted.' });
      load();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const open = (record) => {
    setNotice({ tone: 'success', text: '' });
    setBudget(null);
    setEditing(record);
  };

  return (
    <>
      <div className="page-head">
        <h1>Transactions</h1>
        {!editing && <button type="button" className="btn btn-primary" onClick={() => open({})}>Add transaction</button>}
      </div>
      {notice.text && <Alert tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</Alert>}
      {budget?.alert && (
        <Alert tone={budget.alert.status === 'exceeded' ? 'error' : 'warning'} role={budget.alert.status === 'exceeded' ? 'alert' : 'status'}>
          {budget.alert.status === 'exceeded'
            ? <>Your {budget.alert.category} budget is exceeded by {formatMoney(-budget.alert.remaining)} this month ({budget.alert.percentUsed}% used).</>
            : <>Your {budget.alert.category} budget is {budget.alert.percentUsed}% used; {formatMoney(budget.alert.remaining)} left this month.</>}
          {' '}<Link to="/app/budgets">View budgets</Link>
        </Alert>
      )}
      {budget?.unknown && <Alert role="status">Saved, but your budgets could not be checked right now. Open Budgets to see where you stand.</Alert>}
      {editing && <TransactionForm key={editing.id ?? 'new'} transaction={editing.id ? editing : null} onSave={save} onCancel={() => setEditing(null)} />}
      {loadError ? (
        <Alert tone="error" role="alert">{loadError} <button type="button" className="btn btn-secondary" onClick={load}>Try again</button></Alert>
      ) : !items ? (
        <div className="page-loading" role="status" aria-label="Loading transactions"><span className="spinner" /></div>
      ) : items.length === 0 ? (
        <Alert>You have no transactions yet. Use “Add transaction” to record your first income or expense.</Alert>
      ) : (
        <TransactionTable items={items} busyId={busyId} onEdit={open} onDelete={remove} />
      )}
    </>
  );
}
