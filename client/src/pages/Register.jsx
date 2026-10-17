import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Field from '../components/Field.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useForm from '../hooks/useForm.js';
import usePageTitle from '../hooks/usePageTitle.js';
import { emailError, PASSWORD_HINT, passwordError, requiredError } from '../utils/validate.js';

const validate = (v) => ({
  name: requiredError(v.name, 'your full name'),
  email: emailError(v.email),
  password: passwordError(v.password),
  confirm: !v.confirm ? 'Confirm your password.' : v.confirm !== v.password ? 'Passwords do not match.' : '',
});

export default function Register() {
  usePageTitle('Register');
  const { register } = useAuth();
  const [googleError, setGoogleError] = useState('');
  const form = useForm({ name: '', email: '', password: '', confirm: '' }, validate);
  const submit = ({ name, email, password }) => register({ name, email, password });

  return (
    <form className="form" onSubmit={form.handleSubmit(submit)} noValidate>
      <div>
        <h1>Create your account</h1>
        <p className="muted">Track your own hostel income, expenses and budgets.</p>
      </div>
      {form.formError && <Alert tone="error" role="alert">{form.formError}</Alert>}
      {googleError && <Alert tone="error" role="alert">{googleError}</Alert>}
      <GoogleButton onError={setGoogleError} />
      <Field label="Full name" autoComplete="name" {...form.bind('name')} />
      <Field label="Email" type="email" autoComplete="email" {...form.bind('email')} />
      <Field label="Password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} {...form.bind('password')} />
      <Field label="Confirm password" type="password" autoComplete="new-password" {...form.bind('confirm')} />
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={form.submitting}>{form.submitting ? 'Creating account…' : 'Register'}</button>
      <p className="form-foot">Already registered? <Link to="/login">Login</Link></p>
    </form>
  );
}
