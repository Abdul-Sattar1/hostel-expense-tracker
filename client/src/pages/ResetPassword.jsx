import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import Alert from '../components/Alert.jsx';
import Field from '../components/Field.jsx';
import useForm from '../hooks/useForm.js';
import usePageTitle from '../hooks/usePageTitle.js';
import { PASSWORD_HINT, passwordError } from '../utils/validate.js';

const validate = (v) => ({
  password: passwordError(v.password),
  confirm: !v.confirm ? 'Confirm your password.' : v.confirm !== v.password ? 'Passwords do not match.' : '',
});

export default function ResetPassword() {
  usePageTitle('Reset password');
  const token = useSearchParams()[0].get('token');
  const [done, setDone] = useState('');
  const form = useForm({ password: '', confirm: '' }, validate);
  const submit = async ({ password }) => setDone((await api('/auth/reset-password', { method: 'POST', body: { token, password } })).message);

  if (!token) {
    return (
      <div className="form">
        <h1>Reset link missing</h1>
        <Alert tone="error" role="alert">This page needs the link from your reset email. <Link to="/forgot-password">Request a new link</Link>.</Alert>
      </div>
    );
  }
  if (done) {
    return (
      <div className="form">
        <h1>Password changed</h1>
        <Alert tone="success" role="status">{done}</Alert>
        <Link to="/login" className="btn btn-primary btn-lg btn-block">Go to login</Link>
      </div>
    );
  }
  return (
    <form className="form" onSubmit={form.handleSubmit(submit)} noValidate>
      <div>
        <h1>Choose a new password</h1>
        <p className="muted">The link works once and expires 20 minutes after it was requested.</p>
      </div>
      {form.formError && <Alert tone="error" role="alert">{form.formError} <Link to="/forgot-password">Request a new link</Link></Alert>}
      <Field label="New password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} {...form.bind('password')} />
      <Field label="Confirm new password" type="password" autoComplete="new-password" {...form.bind('confirm')} />
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={form.submitting}>{form.submitting ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}
