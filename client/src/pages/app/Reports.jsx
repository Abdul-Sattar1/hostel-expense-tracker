import { useEffect, useMemo, useState } from 'react';
import { api, download } from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Field from '../../components/Field.jsx';
import Icon from '../../components/Icon.jsx';
import { BudgetProgress, CategoryBars, Donut, TrendChart } from '../../components/ReportCharts.jsx';
import TransactionTable from '../../components/TransactionTable.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import usePageTitle from '../../hooks/usePageTitle.js';
import { formatMoney } from '../../utils/format.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const now = new Date();

// Same rules as server/src/validators/report.js, which is the real enforcement. Returns the query
// string, or `errors` for values that are filled in but wrong ({} while the choice is incomplete).
function buildQuery(f) {
  const errors = {};
  const yearBad = f.year !== '' && !(/^\d{4}$/.test(f.year) && f.year >= 2000 && f.year <= 2100);
  if (f.period === 'month' || f.period === 'year') {
    if (yearBad) errors.year = 'Enter a year between 2000 and 2100.';
    if (f.year === '' || yearBad) return { errors };
  }
  if (f.period === 'custom') {
    if (f.from && f.to && f.from > f.to) errors.to = 'End date must be on or after the start date.';
    if (!f.from || !f.to || errors.to) return { errors };
  }
  const params = { period: f.period };
  if (f.period === 'month') params.month = `${f.year}-${String(f.month).padStart(2, '0')}`;
  if (f.period === 'year') params.year = f.year;
  if (f.period === 'custom') Object.assign(params, { from: f.from, to: f.to });
  return { query: `?${new URLSearchParams(params)}` };
}

export default function Reports() {
  usePageTitle('Reports');
  const { user } = useAuth();
  const [filters, setFilters] = useState({ period: user.preferences?.reportPeriod ?? 'month', month: now.getMonth() + 1, year: String(now.getFullYear()), from: '', to: '' });
  const [result, setResult] = useState(null); // { query, data } of the last successful load
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const [attempt, setAttempt] = useState(0);

  const built = useMemo(() => buildQuery(filters), [filters]);
  const { query } = built;

  // Every change of period reloads the summary, charts, progress bars and table together.
  useEffect(() => {
    if (!query) return undefined;
    let stale = false;
    setLoading(true);
    setError('');
    api(`/reports${query}`).then(
      (data) => !stale && setResult({ query, data }),
      (err) => { if (!stale) { setResult(null); setError(err.message); } },
    ).finally(() => !stale && setLoading(false));
    return () => { stale = true; };
  }, [query, attempt]);

  const bind = (name) => ({
    name,
    value: filters[name],
    error: built.errors?.[name],
    onChange: (e) => setFilters({ ...filters, [name]: e.target.value }),
  });

  const exportAs = async (format) => {
    setExporting(format);
    setError('');
    try {
      await download(`/reports/export.${format}${result.query}`, `hostel-expense-report.${format}`);
    } catch (err) {
      setError(`The ${format.toUpperCase()} export failed: ${err.message}`);
    } finally {
      setExporting('');
    }
  };

  const data = query && result?.query === query ? result.data : null;
  const cards = data && [
    ['Total income', formatMoney(data.totals.income), 'pos'],
    ['Total expenses', formatMoney(data.totals.expenses), 'neg'],
    ['Remaining balance', formatMoney(data.totals.balance), data.totals.balance < 0 ? 'neg' : ''],
    ['Savings percentage', data.totals.savingsPercent === null ? '—' : `${data.totals.savingsPercent}%`, data.totals.savingsPercent < 0 ? 'neg' : data.totals.savingsPercent > 0 ? 'pos' : ''],
    ['Transactions', data.totals.count, ''],
  ];

  return (
    <>
      <h1>Reports</h1>
      <p className="lead">Choose a period. Totals, charts, budget progress and the transaction list all update together.</p>
      <form className="form card tx-form" onSubmit={(e) => e.preventDefault()} noValidate aria-label="Report period">
        <div className="span-2">
          <Field as="select" label="Report type" {...bind('period')}>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="custom">Custom range</option>
            <option value="all">All time</option>
          </Field>
        </div>
        {filters.period === 'month' && (
          <Field as="select" label="Month" {...bind('month')}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Field>
        )}
        {(filters.period === 'month' || filters.period === 'year') && <Field label="Year" inputMode="numeric" maxLength={4} {...bind('year')} />}
        {filters.period === 'custom' && (
          <>
            <Field label="Start date" type="date" max={filters.to || undefined} {...bind('from')} />
            <Field label="End date" type="date" min={filters.from || undefined} {...bind('to')} />
          </>
        )}
      </form>

      {filters.period === 'custom' && !query && !built.errors.to && <Alert>Choose a start and an end date to see the report.</Alert>}
      {error && (
        <Alert tone="error" role="alert">{error} {query && <button type="button" className="btn btn-secondary" onClick={() => setAttempt(attempt + 1)}>Try again</button>}</Alert>
      )}
      {loading && !data && <div className="page-loading" role="status" aria-label="Loading report"><span className="spinner" /></div>}
      {data && (
        <section aria-labelledby="report-title" className="report" aria-busy={loading}>
          <div className="page-head">
            <h2 id="report-title">{data.period.label}</h2>
            <div className="export-row">
              <button type="button" className="btn btn-secondary" onClick={() => exportAs('csv')} disabled={Boolean(exporting) || loading}><Icon name="download" size={16} />{exporting === 'csv' ? 'Preparing CSV…' : 'Export CSV'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => exportAs('pdf')} disabled={Boolean(exporting) || loading}><Icon name="download" size={16} />{exporting === 'pdf' ? 'Preparing PDF…' : 'Export PDF'}</button>
            </div>
          </div>
          <div className="stats totals">
            {cards.map(([label, value, tone]) => <div key={label}><span>{label}</span><strong className={tone}>{value}</strong></div>)}
          </div>
          <div className="chart-grid">
            <section className="card chart-card chart-wide" aria-labelledby="c-trend"><h3 id="c-trend">Income vs expenses</h3><TrendChart series={data.charts.series} /></section>
            <section className="card chart-card" aria-labelledby="c-exp"><h3 id="c-exp">Expenses by category</h3><CategoryBars items={data.charts.expensesByCategory} tone="expense" empty="No expenses in this period." /></section>
            <section className="card chart-card" aria-labelledby="c-inc"><h3 id="c-inc">Income by category</h3><CategoryBars items={data.charts.incomeByCategory} tone="income" empty="No income in this period." /></section>
            <section className="card chart-card chart-wide" aria-labelledby="c-dist"><h3 id="c-dist">Expense distribution</h3><Donut items={data.charts.expensesByCategory} /></section>
            <section className="card chart-card chart-wide" aria-labelledby="c-budget"><h3 id="c-budget">Budget progress</h3><BudgetProgress budgets={data.budgets} /></section>
          </div>
          {data.totals.count === 0 ? (
            <Alert>No transactions match this period. Try another month, year or date range.</Alert>
          ) : (
            <TransactionTable items={data.transactions} />
          )}
        </section>
      )}
    </>
  );
}
