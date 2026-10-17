import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { NAV, SITE } from '../utils/site.js';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo />
          <p>Record hostel income and expenses, and understand where the money goes.</p>
        </div>
        <nav aria-label="Footer">
          <h2>Explore</h2>
          <ul>
            {NAV.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/register">Register</Link></li>
          </ul>
        </nav>
        <address>
          <h2>Institution</h2>
          <p>{SITE.department}</p>
          <p>{SITE.campus}</p>
          <p>{SITE.address}</p>
        </address>
      </div>
      <div className="container footer-bottom">
        <p>{SITE.developer}</p>
        <p>{SITE.copyright}</p>
      </div>
    </footer>
  );
}
