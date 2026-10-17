import { formatDate, formatMoney } from '../utils/format.js';

// Rows are read-only unless onEdit/onDelete are given (the dashboard shows recent ones without actions).
export default function TransactionTable({ items, onEdit, onDelete, busyId }) {
  const actions = Boolean(onEdit);
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Transactions, scrollable">
      <table className="tx-table">
        <thead>
          <tr>
            <th>Date</th><th>Type</th><th>Category / description</th><th className="num">Amount</th>
            {actions && <th><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const income = t.type === 'income';
            return (
              <tr key={t.id}>
                <td>{formatDate(t.date)}</td>
                <td><span className={`badge ${income ? 'badge-live' : 'badge-muted'}`}>{income ? 'Income' : 'Expense'}</span></td>
                <td>{t.category}{t.description && <span className="muted"> · {t.description}</span>}</td>
                <td className={`num ${income ? 'pos' : 'neg'}`}>{income ? '+' : '−'}{formatMoney(t.amount)}</td>
                {actions && (
                  <td>
                    <div className="tx-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => onEdit(t)} disabled={busyId === t.id} aria-label={`Edit ${t.category} transaction`}>Edit</button>
                      <button type="button" className="btn btn-secondary" onClick={() => onDelete(t)} disabled={busyId === t.id} aria-label={`Delete ${t.category} transaction`}>{busyId === t.id ? 'Deleting…' : 'Delete'}</button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
