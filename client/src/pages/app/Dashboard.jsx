import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import TransactionTable from '../../components/TransactionTable.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import usePageTitle from '../../hooks/usePageTitle.js';
import { formatMoney } from '../../utils/format.js';

export default function Dashboard() {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/transactions/summary').then(setSummary, (err) => setError(err.message));
  }, []);

  const totals = summary && [
    ['Total income', summary.totalIncome, 'pos'],
    ['Total expenses', summary.totalExpenses, 'neg'],
    ['Remaining balance', summary.balance, summary.balance < 0 ? 'neg' : ''],
  ];

  return (
    <>
      <h1>Welcome, {user.name.split(' ')[0]}</h1>
      <p className="lead">Signed in as {user.email}. Your account is private: only you can see your records.</p>
      {error ? (
        <Alert tone="error" role="alert">{error}</Alert>
      ) : !summary ? (
        <div className="page-loading" role="status" aria-label="Loading summary"><span className="spinner" /></div>
      ) : (
        <>
          <div className="stats totals">
            {totals.map(([label, value, tone]) => (
              <div key={label}><span>{label}</span><strong className={tone}>{formatMoney(value)}</strong></div>
            ))}
          </div>
          {summary.count === 0 ? (
            <Alert>No transactions yet, so every total is zero. <Link to="/app/transactions">Add your first income or expense</Link> to get started.</Alert>
          ) : (
            <section aria-labelledby="recent-title">
              <h2 id="recent-title">Recent transactions</h2>
              <TransactionTable items={summary.recent} />
              <p><Link to="/app/transactions">View all {summary.count} transactions</Link></p>
            </section>
          )}
        </>
      )}
    </>
  );
}
