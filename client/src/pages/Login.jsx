import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Field from '../components/Field.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useForm from '../hooks/useForm.js';
import usePageTitle from '../hooks/usePageTitle.js';
import { emailError } from '../utils/validate.js';

const validate = (v) => ({ email: emailError(v.email), password: v.password ? '' : 'Enter your password.' });

export default function Login() {
  usePageTitle('Login');
  const { login, expired } = useAuth();
  const [googleError, setGoogleError] = useState('');
  const form = useForm({ email: '', password: '' }, validate);

  return (
    <form className="form" onSubmit={form.handleSubmit(login)} noValidate>
      <div>
        <h1>Welcome back</h1>
        <p className="muted">Log in to your Hostel Expense Tracker account.</p>
      </div>
      {expired && <Alert role="status">Your session has expired. Please log in again.</Alert>}
      {form.formError && <Alert tone="error" role="alert">{form.formError}</Alert>}
      {googleError && <Alert tone="error" role="alert">{googleError}</Alert>}
      <GoogleButton onError={setGoogleError} />
      <Field label="Email" type="email" autoComplete="email" {...form.bind('email')} />
      <Field label="Password" type="password" autoComplete="current-password" {...form.bind('password')} />
      <p className="forgot"><Link to="/forgot-password">Forgot password?</Link></p>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={form.submitting}>{form.submitting ? 'Logging in…' : 'Login'}</button>
      <p className="form-foot">New here? <Link to="/register">Create an account</Link></p>
    </form>
  );
}
