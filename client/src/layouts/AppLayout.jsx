import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import AvatarMenu from '../components/AvatarMenu.jsx';
import Alert from '../components/Alert.jsx';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ITEMS = [
  { to: '/app', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/app/transactions', label: 'Transactions', icon: 'list' },
  { to: '/app/budgets', label: 'Budgets', icon: 'target' },
  { to: '/app/reports', label: 'Reports', icon: 'file' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const onLogout = async () => {
    setBusy(true);
    setError('');
    try {
      await logout();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="app-top">
        <button type="button" className="menu-btn app-menu" aria-expanded={open} aria-controls="app-side" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'x' : 'menu'} />
        </button>
        <Logo />
        <span className="spacer" />
        <ThemeToggle />
        <AvatarMenu user={user} onLogout={onLogout} busy={busy} />
      </header>
      <aside id="app-side" className="app-side" data-open={open}>
        <nav aria-label="Account">
          <ul>
            {ITEMS.map((i) => (
              <li key={i.to}>
                <NavLink to={i.to} end={i.end}>
                  <Icon name={i.icon} size={18} />
                  <span>{i.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="side-user" title={user.email}>
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </p>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <main id="main" className="app-main">
        {error && <Alert tone="error" role="alert">Could not log out: {error}</Alert>}
        <Outlet />
      </main>
    </div>
  );
}
