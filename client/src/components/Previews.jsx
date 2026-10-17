import Icon from './Icon.jsx';

const fmt = (n) => `Rs ${n.toLocaleString('en-US')}`;

function Window({ title, children, label }) {
  return (
    <figure className="window" aria-label={label}>
      <figcaption className="window-bar">
        <span>{title}</span>
        <span className="badge">Illustrative demo data</span>
      </figcaption>
      <div className="window-body">{children}</div>
    </figure>
  );
}

const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const INCOME = [40, 40, 42, 40, 45, 40];
const EXPENSE = [29, 34, 26, 31, 38, 21.55];

const W = 320, H = 170, L = 34, R = 2, T = 8, B = 22, MAX = 50, BAR = 14;
const plotH = H - T - B;
const group = (W - L - R) / MONTHS.length;
const barPath = (x, v, r = 4) => {
  const h = (plotH * v) / MAX;
  return `M${x} ${T + plotH}v${-(h - r)}a${r} ${r} 0 0 1 ${r} ${-r}h${BAR - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - r}z`;
};

export function DashboardPreview() {
  return (
    <Window title="Dashboard preview" label="Illustrative dashboard preview with demo data">
      <div className="stats">
        <div><span>Balance</span><strong>{fmt(18450)}</strong></div>
        <div><span>Income</span><strong>{fmt(40000)}</strong></div>
        <div><span>Spent</span><strong>{fmt(21550)}</strong></div>
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--series-1)' }} />Income</span>
        <span><i style={{ background: 'var(--series-2)' }} />Expenses</span>
        <span className="legend-note">Rs, thousands per month</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart comparing sample monthly income and expenses over six months. Demo data only.">
        {[0, 25, 50].map((v) => {
          const y = T + plotH * (1 - v / MAX);
          return (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--border)" />
              <text x={L - 6} y={y + 4} textAnchor="end">{v}</text>
            </g>
          );
        })}
        {MONTHS.map((m, i) => {
          const x = L + group * i + (group - (2 * BAR + 2)) / 2;
          return (
            <g key={m}>
              <path d={barPath(x, INCOME[i])} fill="var(--series-1)"><title>{`${m} income: ${fmt(INCOME[i] * 1000)}`}</title></path>
              <path d={barPath(x + BAR + 2, EXPENSE[i])} fill="var(--series-2)"><title>{`${m} expenses: ${fmt(Math.round(EXPENSE[i] * 1000))}`}</title></path>
              <text x={L + group * (i + 0.5)} y={H - 6} textAnchor="middle">{m}</text>
            </g>
          );
        })}
      </svg>
    </Window>
  );
}

const ROWS = [
  ['12 Oct', 'Mess bill', 'Food', 'Cash', -3200],
  ['10 Oct', 'Allowance from family', 'Income', 'Bank transfer', 40000],
  ['09 Oct', 'Bus fare', 'Transport', 'Cash', -450],
  ['07 Oct', 'Printing and stationery', 'Study', 'Mobile wallet', -600],
  ['05 Oct', 'Hostel dues', 'Rent', 'Bank transfer', -6000],
];

export function TransactionsPreview() {
  return (
    <Window title="Transactions preview" label="Illustrative transactions table with demo data">
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Sample transactions table, scrollable">
        <table>
          <thead>
            <tr><th>Date</th><th>Description</th><th>Category</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {ROWS.map(([date, desc, cat, , amt]) => (
              <tr key={desc}>
                <td>{date}</td><td>{desc}</td><td>{cat}</td>
                <td className={`num ${amt > 0 ? 'pos' : 'neg'}`}>{amt > 0 ? '+' : '−'}{fmt(Math.abs(amt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Window>
  );
}

const CATEGORIES = [['Food', 8900], ['Hostel dues', 6000], ['Transport', 2650], ['Study', 2000], ['Other', 2000]];
const BUDGETS = [
  ['Food', 8900, 10000],
  ['Transport', 2650, 2500],
  ['Study', 2000, 4000],
];
const status = (pct) => (pct > 100 ? ['bad', 'Over budget', 'alert'] : pct >= 80 ? ['warn', 'Approaching limit', 'alert'] : ['ok', 'On track', 'check']);

export function InsightsPreview() {
  const top = CATEGORIES[0][1];
  return (
    <Window title="Spending and budgets preview" label="Illustrative category spending and budgets with demo data">
      <div className="insights">
        <div>
          <h3 className="mini-title">Spending by category</h3>
          <ul className="bars">
            {CATEGORIES.map(([name, v]) => (
              <li key={name}>
                <span>{name}</span>
                <div className="meter"><span style={{ width: `${(v / top) * 100}%`, background: 'var(--series-1)' }} /></div>
                <b>{fmt(v)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mini-title">Monthly budgets</h3>
          <ul className="budgets">
            {BUDGETS.map(([name, spent, limit]) => {
              const pct = Math.round((spent / limit) * 100);
              const [tone, text, icon] = status(pct);
              return (
                <li key={name}>
                  <div className="budget-head"><span>{name}</span><b>{pct}%</b></div>
                  <div className="meter"><span className={`bar-${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                  <small className={`status status-${tone}`}><Icon name={icon} size={13} />{text}</small>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Window>
  );
}

export function ReportsPreview() {
  return (
    <Window title="Expense report preview" label="Illustrative expense report with demo data">
      <div className="filters" aria-hidden="true">
        <span className="chip chip-on">Month</span>
        <span className="chip">Year</span>
        <span className="chip">Custom range</span>
        <span className="chip">All records</span>
      </div>
      <div className="stats stats-4">
        <div><span>Income</span><strong>{fmt(40000)}</strong></div>
        <div><span>Expenses</span><strong>{fmt(21550)}</strong></div>
        <div><span>Net</span><strong>{fmt(18450)}</strong></div>
        <div><span>Transactions</span><strong>24</strong></div>
      </div>
      <p className="export-row">
        <span className="chip chip-dashed"><Icon name="download" size={14} />Export CSV</span>
        <span className="chip chip-dashed"><Icon name="file" size={14} />Export PDF</span>
      </p>
    </Window>
  );
}
