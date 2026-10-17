import { useState } from 'react';
import { api } from '../api/client.js';
import Alert from '../components/Alert.jsx';
import Field from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';
import useForm from '../hooks/useForm.js';
import usePageTitle from '../hooks/usePageTitle.js';
import { SITE } from '../utils/site.js';
import { emailError, requiredError } from '../utils/validate.js';

const MAPS_URL = 'https://www.google.com/maps/place/Department+of+Software+Engineering+MUET+SZAB/@27.5287005,68.7443796,17z/data=!3m1!4b1!4m6!3m5!1s0x3935db961f5d5269:0x9b98a2c704b19c23!8m2!3d27.5286958!4d68.7469545!16s%2Fg%2F11h4ldrt1s';

// Mirrors server/src/validators/contact.js, which is the real enforcement.
const validate = (v) => ({
  name: requiredError(v.name, 'your name'),
  email: emailError(v.email),
  subject: v.subject.length > 120 ? 'Use at most 120 characters.' : '',
  message: !v.message.trim() ? 'Enter your message.' : v.message.trim().length < 10 ? 'Write at least 10 characters so we can understand your message.' : v.message.length > 2000 ? 'Use at most 2000 characters.' : '',
});

export default function Contact() {
  usePageTitle('Contact Us');
  const [done, setDone] = useState('');
  const form = useForm({ name: '', email: '', subject: '', message: '', website: '' }, validate);
  const submit = form.handleSubmit(async (v) => {
    setDone('');
    const data = await api('/contact', { method: 'POST', body: v });
    setDone(data.message);
    form.reset();
  });

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Contact Us</p>
          <h1>Questions or feedback?</h1>
          <p className="lead">Write to us using the form, or find the department at the address shown.</p>
        </div>
      </section>
      <section className="section">
        <div className="container two-col wide-first">
          <form className="card form" onSubmit={submit} noValidate>
            {done && <Alert tone="success" role="status">{done}</Alert>}
            {form.formError && <Alert tone="error" role="alert">{form.formError}</Alert>}
            <Field label="Name" autoComplete="name" {...form.bind('name')} />
            <Field label="Email" type="email" autoComplete="email" {...form.bind('email')} />
            <Field label="Subject (optional)" maxLength={120} {...form.bind('subject')} />
            <Field label="Message" as="textarea" rows={6} maxLength={2000} {...form.bind('message')} />
            <div className="sr-only" aria-hidden="true">
              <label>Leave this field empty<input type="text" tabIndex={-1} autoComplete="off" {...form.bind('website')} /></label>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={form.submitting}>{form.submitting ? 'Sending…' : 'Send message'}</button>
          </form>
          <aside className="institution" aria-label="Location">
            <h2>Find us</h2>
            <p className="location"><Icon name="pin" /><span>{SITE.department}<br />{SITE.campus}<br />Old Station Road, Khairpur, Sindh, Pakistan<br />Postal Code: 66020</span></p>
            <p><a className="btn btn-secondary" href={MAPS_URL} target="_blank" rel="noopener noreferrer">Open in Google Maps<span className="sr-only"> (opens in a new tab)</span></a></p>
          </aside>
        </div>
      </section>
    </>
  );
}
