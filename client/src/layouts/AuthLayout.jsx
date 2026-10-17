import { Link, Outlet } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const POINTS = ['Record income and expenses in one place', 'Set monthly budgets by category', 'Review monthly, yearly and custom-range reports'];

export default function AuthLayout() {
  return (
    <div className="auth">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="auth-panel">
        <Logo />
        <div>
          <h2>Know where your allowance goes.</h2>
          <ul>
            {POINTS.map((p) => <li key={p}><Icon name="check" size={18} />{p}</li>)}
          </ul>
        </div>
        <p>Your records are private to your account.</p>
      </aside>
      <div className="auth-main">
        <div className="auth-top">
          <Link to="/" className="back-link"><Icon name="arrow" size={16} style={{ transform: 'scaleX(-1)' }} />Back to website</Link>
          <ThemeToggle />
        </div>
        <main id="main" className="auth-card"><Outlet /></main>
      </div>
    </div>
  );
}
