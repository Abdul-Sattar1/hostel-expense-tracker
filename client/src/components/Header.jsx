import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV } from '../utils/site.js';

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Logo />
        <nav id="site-nav" className="nav" data-open={open} aria-label="Main">
          <ul>
            {NAV.map((l) => (
              <li key={l.to}><NavLink to={l.to} end={l.to === '/'}>{l.label}</NavLink></li>
            ))}
          </ul>
          <div className="nav-cta">
            {user ? (
              <Link to="/app" className="btn btn-primary">Open dashboard</Link>
            ) : !loading && (
              <>
                <Link to="/login" className="btn btn-ghost">Login</Link>
                <Link to="/register" className="btn btn-primary">Register</Link>
              </>
            )}
          </div>
        </nav>
        <ThemeToggle />
        <button type="button" className="menu-btn" aria-expanded={open} aria-controls="site-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'x' : 'menu'} />
        </button>
      </div>
    </header>
  );
}
