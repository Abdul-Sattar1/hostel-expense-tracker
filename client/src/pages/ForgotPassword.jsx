import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Alert from '../components/Alert.jsx';
import Field from '../components/Field.jsx';
import useForm from '../hooks/useForm.js';
import usePageTitle from '../hooks/usePageTitle.js';
import { emailError } from '../utils/validate.js';

export default function ForgotPassword() {
  usePageTitle('Forgot password');
  const [sent, setSent] = useState('');
  const form = useForm({ email: '' }, (v) => ({ email: emailError(v.email) }));
  const submit = async (v) => setSent((await api('/auth/forgot-password', { method: 'POST', body: v })).message);

  return (
    <form className="form" onSubmit={form.handleSubmit(submit)} noValidate>
      <div>
        <h1>Forgot your password?</h1>
        <p className="muted">Enter your account email and we will send you a link to choose a new password.</p>
      </div>
      {sent && <Alert tone="success" role="status">{sent}</Alert>}
      {form.formError && <Alert tone="error" role="alert">{form.formError}</Alert>}
      <Field label="Email" type="email" autoComplete="email" {...form.bind('email')} />
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={form.submitting}>{form.submitting ? 'Sending…' : 'Send reset link'}</button>
      <p className="form-foot"><Link to="/login">Back to login</Link></p>
    </form>
  );
}
