import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Where a student lands after logging in (their saved preference).
const LANDING = { dashboard: '/app', transactions: '/app/transactions', budgets: '/app/budgets', reports: '/app/reports' };

const Loading = () => (
  <div className="page-loading" role="status" aria-label="Loading">
    <span className="spinner" />
  </div>
);

// UX only: hiding routes is not security. Every private API call is authorized by the server.
export function RequireAuth() {
  const { user, loading, loggedOut } = useAuth();
  const { pathname, search } = useLocation();
  if (loading) return <Loading />;
  if (user) return <Outlet />;
  return loggedOut ? <Navigate to="/" replace /> : <Navigate to="/login" replace state={{ from: pathname + search }} />;
}

export function GuestOnly() {
  const { user, loading } = useAuth();
  const { state } = useLocation();
  if (loading) return <Loading />;
  return user ? <Navigate to={state?.from ?? LANDING[user.preferences?.landingPage] ?? '/app'} replace /> : <Outlet />;
}
