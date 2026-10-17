import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { DashboardPreview, InsightsPreview, ReportsPreview, TransactionsPreview } from '../components/Previews.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const BENEFITS = [
  ['list', 'See every rupee', 'Log allowances, mess bills, fares and fees with a category and date, so nothing slips by unnoticed.'],
  ['target', 'Stay inside your limits', 'Set a monthly budget per category and get a warning as you approach it, not after you pass it.'],
  ['chart', 'Understand your habits', 'Summaries and charts show where the month went and how spending changes over time.'],
  ['phone', 'Works on any screen', 'Check or update your records from a phone, tablet or laptop with the same clean layout.'],
];

const STEPS = [
  ['Register', 'Create your own private account. Every student sees only their own records.'],
  ['Record', 'Add income and expenses as they happen, with a category, date and description.'],
  ['Review', 'Open your dashboard and reports to see totals, budgets and trends, then export them.'],
];

export default function Home() {
  usePageTitle();
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">For hostel students</p>
            <h1>Know where your hostel money goes.</h1>
            <p className="lead">Record your income and expenses, set monthly budgets and see your spending in clear summaries, so the end of the month holds no surprises.</p>
            <div className="actions">
              <Link to="/register" className="btn btn-primary btn-lg">Register <Icon name="arrow" size={18} /></Link>
              <Link to="/features" className="btn btn-secondary btn-lg">Explore Features</Link>
            </div>
            <p className="note">The figures in these previews are illustrative demo data, not real records.</p>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="section section-alt">
        <div className="container two-col">
          <div>
            <p className="eyebrow">Why track</p>
            <h2>Small expenses add up. Records make them visible.</h2>
            <p className="lead">A hostel budget is easy to lose track of. A simple, honest record turns guesswork into something you can plan with.</p>
          </div>
          <ul className="rows">
            {BENEFITS.map(([icon, title, text]) => (
              <li key={title}>
                <span className="icon-box"><Icon name={icon} /></span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">Expense tracking</p>
            <h2>Every transaction in one clear list.</h2>
            <p className="lead">Add income or expenses with an amount, category, date and description. Edit or delete any record, and see your history with the newest first.</p>
          </div>
          <TransactionsPreview />
        </div>
      </section>

      <section className="section section-alt">
        <div className="container split split-reverse">
          <div>
            <p className="eyebrow">Summaries and budgets</p>
            <h2>See the shape of your month at a glance.</h2>
            <p className="lead">Category breakdowns show what takes the biggest share. Budget meters warn you when a category is approaching or over its monthly limit.</p>
          </div>
          <InsightsPreview />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2>Three simple steps</h2>
          </div>
          <ol className="steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container split">
          <div>
            <p className="eyebrow">Reports and export</p>
            <h2>Monthly, yearly or any date range.</h2>
            <p className="lead">Choose a month, a full year, a custom range or all records, review the totals, and export the complete report to CSV or PDF.</p>
          </div>
          <ReportsPreview />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <h2>Start keeping track.</h2>
            <p>Create your student account and take control of your hostel budget.</p>
            <Link to="/register" className="btn btn-light btn-lg">Register <Icon name="arrow" size={18} /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
