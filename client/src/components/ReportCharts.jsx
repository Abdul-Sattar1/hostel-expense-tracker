import { Link } from 'react-router-dom';
import Alert from './Alert.jsx';
import Icon from './Icon.jsx';
import { formatMoney } from '../utils/format.js';

// Charts are plain SVG/CSS drawn from the report API response; no chart library is needed.
const PALETTE = ['#2563eb', '#d97706', '#059669', '#db2777', '#7c3aed', '#0891b2', '#65a30d', '#dc2626'];
const BUDGET_STYLE = {
  ok: ['bar-ok', 'status-ok', 'check', 'Normal'],
  warning: ['bar-warn', 'status-warn', 'alert', 'Warning'],
  exceeded: ['bar-bad', 'status-bad', 'alert', 'Exceeded'],
};

const compact = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(Math.round(n)));
const niceMax = (v) => {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};
const bucketLabel = (key, unit) =>
  unit === 'day' ? String(Number(key.slice(8))) : new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const bucketTitle = (key, unit) =>
  new Date(`${unit === 'day' ? key : `${key}-01`}T00:00:00Z`).toLocaleDateString('en-GB', unit === 'day' ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } : { month: 'long', year: 'numeric', timeZone: 'UTC' });

const Empty = ({ children }) => <p className="muted chart-empty">{children}</p>;

export function TrendChart({ series }) {
  const { unit, points } = series;
  const peak = Math.max(0, ...points.flatMap((p) => [p.income, p.expenses]));
  if (!peak) return <Empty>No income or expenses in this period.</Empty>;

  const slot = unit === 'day' ? 26 : 56;
  const pad = { l: 46, r: 8, t: 12, b: 30 };
  const W = Math.max(320, pad.l + pad.r + points.length * slot);
  const H = 240;
  const max = niceMax(peak);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const bar = Math.max(4, (slot - 6) / 2);
  const totalIncome = points.reduce((s, p) => s + p.income, 0);
  const totalExpenses = points.reduce((s, p) => s + p.expenses, 0);

  return (
    <>
      <p className="legend">
        <span><i style={{ background: 'var(--income)' }} />Income</span>
        <span><i style={{ background: 'var(--expense)' }} />Expenses</span>
        <span className="legend-note">per {unit}</span>
      </p>
      <div className="chart-scroll" tabIndex={0} role="region" aria-label="Income versus expenses chart, scrollable">
        <svg className="chart" style={{ minWidth: W }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart of income and expenses per ${unit}. Total income ${formatMoney(totalIncome)}, total expenses ${formatMoney(totalExpenses)}.`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y((max * i) / 4)} y2={y((max * i) / 4)} stroke="var(--border)" />
              <text x={pad.l - 6} y={y((max * i) / 4) + 4} textAnchor="end">{compact((max * i) / 4)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = pad.l + i * slot + 3;
            return (
              <g key={p.key}>
                <title>{`${bucketTitle(p.key, unit)}: income ${formatMoney(p.income)}, expenses ${formatMoney(p.expenses)}`}</title>
                <rect x={x} y={y(p.income)} width={bar} height={y(0) - y(p.income)} fill="var(--income)" rx="2" />
                <rect x={x + bar} y={y(p.expenses)} width={bar} height={y(0) - y(p.expenses)} fill="var(--expense)" rx="2" />
                <text x={x + bar} y={H - 10} textAnchor="middle">{bucketLabel(p.key, unit)}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

export function CategoryBars({ items, tone, empty }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="cat-list">
      {items.map((c) => (
        <li key={c.category}>
          <div className="budget-head"><span>{c.category}</span><span>{formatMoney(c.amount)} · {c.percent}%</span></div>
          <div className="meter" role="img" aria-label={`${c.category}: ${c.percent}% of total, ${formatMoney(c.amount)}`}>
            <span style={{ width: `${c.percent}%`, background: `var(--${tone})` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({ items }) {
  if (!items.length) return <Empty>No expenses in this period.</Empty>;
  const total = items.reduce((s, c) => s + c.amount, 0);
  let used = 0;
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 42 42" role="img" aria-label={`Doughnut chart of ${formatMoney(total)} in expenses by category`}>
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
        {items.map((c, i) => {
          const pct = (c.amount / total) * 100;
          const offset = 25 - used;
          used += pct;
          return <circle key={c.category} cx="21" cy="21" r="15.9155" fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />;
        })}
        <text x="21" y="22.5" textAnchor="middle" className="donut-total">{compact(total)}</text>
      </svg>
      <ul className="legend-list">
        {items.map((c, i) => (
          <li key={c.category}><i style={{ background: PALETTE[i % PALETTE.length] }} /><span>{c.category}</span><b>{c.percent}%</b></li>
        ))}
      </ul>
    </div>
  );
}

// `budgets` is null unless the selected period is the current month (budgets are monthly limits).
export function BudgetProgress({ budgets }) {
  if (budgets === null) return <Alert>Budget progress compares this month's spending with your monthly budgets, so it is only shown when the selected period is the current month.</Alert>;
  if (!budgets.length) return <Empty>You have no budgets yet. <Link to="/app/budgets">Set one on the Budgets page.</Link></Empty>;
  return (
    <ul className="cat-list">
      {budgets.map((b) => {
        const [bar, tone, icon, label] = BUDGET_STYLE[b.status];
        return (
          <li key={b.id}>
            <div className="budget-head"><span>{b.category}</span><span className={`status ${tone}`}><Icon name={icon} size={16} />{label}</span></div>
            <div className="meter" role="progressbar" aria-label={`${b.category} budget used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(b.percentUsed, 100)} aria-valuetext={`${b.percentUsed}% used`}>
              <span className={bar} style={{ width: `${Math.min(b.percentUsed, 100)}%` }} />
            </div>
            <p className="budget-line">
              <span>{b.percentUsed}% used · {formatMoney(b.spent)} of {formatMoney(b.limit)}</span>
              <span>{b.remaining < 0 ? `Over by ${formatMoney(-b.remaining)}` : `${formatMoney(b.remaining)} left`}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
