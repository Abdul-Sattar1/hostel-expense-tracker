import Icon from '../components/Icon.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { SITE } from '../utils/site.js';

export default function About() {
  usePageTitle('About Us');
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">About Us</p>
          <h1>Making everyday hostel spending easier to see.</h1>
          <p className="lead">Hostel Expense Tracker is a student project that helps students record income and expenses and understand their budgets.</p>
        </div>
      </section>
      <section className="section">
        <div className="container two-col wide-first">
          <div className="prose">
            <h2>The challenge</h2>
            <p>Living in a hostel means managing money in many small pieces: an allowance, mess bills, fares, printing, snacks and shared costs. Because each amount is small, it is easy to forget where the month's money went.</p>
            <h2>Why recording helps</h2>
            <p>Writing down income and spending turns memory into evidence. With organized records, a student can see which categories take the largest share, compare months, and decide where to cut back before money runs out.</p>
            <h2>Budgets you can act on</h2>
            <p>Records are most useful when they lead to a plan. Monthly category budgets, compared with what was actually spent, show early whether a limit is close or already passed.</p>
            <h2>Educational context</h2>
            <p>This application is built as a Cloud Computing practical (OEL) project by Software Engineering students. It is a learning project, not a commercial financial service.</p>
          </div>
          <aside className="institution" aria-label="Institution details">
            <h2>Institution</h2>
            <dl>
              <div><dt>Department</dt><dd>{SITE.department}</dd></div>
              <div><dt>University and campus</dt><dd>{SITE.campus}</dd></div>
              <div><dt>Address</dt><dd><Icon name="pin" size={16} /> {SITE.address}</dd></div>
              <div><dt>Developer credit</dt><dd>{SITE.developer}</dd></div>
            </dl>
          </aside>
        </div>
      </section>
    </>
  );
}
