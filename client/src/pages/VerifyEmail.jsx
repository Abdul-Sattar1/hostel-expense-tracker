import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import Alert from '../components/Alert.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

// The link only shows a button; the change happens when the student confirms (not on page load),
// so mail scanners or accidental previews cannot use up the single-use token.
export default function VerifyEmail() {
  usePageTitle('Confirm email');
  const token = useSearchParams()[0].get('token');
  const { user, updateUser } = useAuth();
  const [state, setState] = useState({ status: 'idle', message: '' });

  const confirm = async () => {
    setState({ status: 'busy', message: '' });
    try {
      const data = await api('/profile/email/verify', { method: 'POST', body: { token } });
      if (user) updateUser((await api('/auth/me')).user);
      setState({ status: 'done', message: data.message });
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  };

  if (!token) {
    return (
      <div className="form">
        <h1>Confirmation link missing</h1>
        <Alert tone="error" role="alert">This page needs the link from your confirmation email.</Alert>
      </div>
    );
  }
  return (
    <div className="form">
      <h1>Confirm your new email</h1>
      {state.status === 'done' ? (
        <>
          <Alert tone="success" role="status">{state.message}</Alert>
          <Link to={user ? '/app/settings' : '/login'} className="btn btn-primary btn-lg btn-block">{user ? 'Back to settings' : 'Go to login'}</Link>
        </>
      ) : (
        <>
          <p className="muted">Confirm that this address should become the email for your Hostel Expense Tracker account.</p>
          {state.status === 'error' && <Alert tone="error" role="alert">{state.message}</Alert>}
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={confirm} disabled={state.status === 'busy'}>{state.status === 'busy' ? 'Confirming…' : 'Confirm email change'}</button>
        </>
      )}
    </div>
  );
}
