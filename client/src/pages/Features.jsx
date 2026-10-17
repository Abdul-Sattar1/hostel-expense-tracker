import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const GROUPS = [
  {
    title: 'Track',
    text: 'Capture money coming in and going out.',
    items: [
      ['wallet', 'Income and expense tracking', 'Record amount, type, category, description and date. Edit or delete any record later.', true],
      ['list', 'Categories and transaction history', 'See every transaction in one list, newest first, with income and expenses clearly marked.', true],
    ],
  },
  {
    title: 'Plan',
    text: 'Set limits before the month runs away.',
    items: [['target', 'Monthly budgets and spending alerts', 'Set a monthly budget per category and see warnings when you approach or exceed it.', true]],
  },
  {
    title: 'Understand',
    text: 'Turn records into clear answers.',
    items: [
      ['chart', 'Dashboard summaries and charts', 'Total income, expenses and balance with recent activity on your dashboard, plus charts on the Reports page, all from your own data.', true],
      ['calendar', 'Monthly reports', 'Pick a month and year to see totals and every matching transaction.', true],
      ['calendar', 'Yearly reports', 'Review a full calendar year, including how spending trends over time.', true],
      ['calendar', 'Custom date-range reports', 'Choose any start and end date, or all records.', true],
    ],
  },
  {
    title: 'Export',
    text: 'Take your records with you.',
    items: [['download', 'CSV and PDF export', 'Export the complete selected report, not just the rows on screen.', true]],
  },
  {
    title: 'Everywhere',
    text: 'Comfortable on any device, day or night.',
    items: [
      ['phone', 'Responsive access', 'Layouts adapt to phones, tablets, laptops and desktops. Works on the website today.', true],
      ['monitor', 'System-aware light and dark mode', 'Follows your device setting by default, with a manual System, Light or Dark choice. Works today.', true],
    ],
  },
];

export default function Features() {
  usePageTitle('Features');
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Features</p>
          <h1>Everything a hostel budget needs, nothing it doesn't.</h1>
          <p className="lead">Track transactions, set budgets, review reports and export them. Every account is private to its student.</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {GROUPS.map((g) => (
            <div className="two-col feature-group" key={g.title}>
              <div>
                <h2>{g.title}</h2>
                <p className="muted">{g.text}</p>
              </div>
              <ul className="rows">
                {g.items.map(([icon, title, text, live]) => (
                  <li key={title}>
                    <span className="icon-box"><Icon name={icon} /></span>
                    <div>
                      <h3>{title} <span className={`badge ${live ? 'badge-live' : 'badge-muted'}`}>{live ? 'Available' : 'Planned'}</span></h3>
                      <p>{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="feature-cta"><Link to="/register" className="btn btn-primary">Register</Link></p>
        </div>
      </section>
    </>
  );
}
