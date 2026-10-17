import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, download, upload } from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Avatar from '../../components/Avatar.jsx';
import Field from '../../components/Field.jsx';
import GoogleButton from '../../components/GoogleButton.jsx';
import Icon from '../../components/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import useForm from '../../hooks/useForm.js';
import usePageTitle from '../../hooks/usePageTitle.js';
import { emailError, PASSWORD_HINT, passwordError, requiredError } from '../../utils/validate.js';

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'data', label: 'Data & privacy' },
];

// Runs a save call, stores the refreshed user and reports the result next to the form.
function useSave(onUser) {
  const [notice, setNotice] = useState(null);
  const run = async (call) => {
    setNotice(null);
    const data = await call();
    onUser(data.user);
    setNotice({ tone: 'success', text: data.message });
  };
  return [notice, run];
}

const Notice = ({ notice }) => (notice ? <Alert tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</Alert> : null);

function Block({ title, children }) {
  return (
    <section className="settings-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Photo({ user, onUser }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(null); // { file, url } chosen but not saved yet

  useEffect(() => () => pending && URL.revokeObjectURL(pending.url), [pending]);

  const choose = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) return setNotice({ tone: 'error', text: 'Choose a JPEG, PNG or WebP image.' });
    if (file.size > MAX_BYTES) return setNotice({ tone: 'error', text: 'The image must be 2 MB or smaller.' });
    setNotice(null);
    setPending({ file, url: URL.createObjectURL(file) });
  };
  const act = async (call, success) => {
    setBusy(true);
    setNotice(null);
    try {
      onUser((await call()).user);
      setPending(null);
      setNotice({ tone: 'success', text: success });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Block title="Profile picture">
      <div className="avatar-row">
        {pending ? <img className="avatar" style={{ width: 72, height: 72 }} src={pending.url} alt="Preview of the new picture" /> : <Avatar user={user} size={72} />}
        <div className="tx-actions">
          {pending ? (
            <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => upload('/profile/avatar', pending.file), 'Profile picture updated.')}>{busy ? 'Saving…' : 'Save picture'}</button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
            </>
          ) : (
            <>
              <input id="avatar-file" className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={busy} />
              <label htmlFor="avatar-file" className="btn btn-secondary">{user.avatarUpdatedAt ? 'Replace picture' : 'Upload picture'}</label>
              {user.avatarUpdatedAt && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => act(() => api('/profile/avatar', { method: 'DELETE' }), 'Profile picture removed.')}>{busy ? 'Working…' : 'Remove'}</button>}
            </>
          )}
        </div>
      </div>
      <p className="muted">{pending ? 'This is a preview. Nothing is saved until you choose Save picture.' : 'JPEG, PNG or WebP, up to 2 MB. Only you can see it.'}</p>
      <Notice notice={notice} />
    </Block>
  );
}

function NameForm({ user, onUser, onDone }) {
  const form = useForm({ name: user.name }, (v) => ({ name: requiredError(v.name, 'your full name') }));
  const submit = form.handleSubmit(async (v) => {
    onUser((await api('/profile', { method: 'PATCH', body: { name: v.name.trim() } })).user);
    onDone('Name updated.');
  });
  return (
    <form className="form" onSubmit={submit} noValidate>
      {form.formError && <Alert tone="error" role="alert">{form.formError}</Alert>}
      <Field label="Full name" autoComplete="name" {...form.bind('name')} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>{form.submitting ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-secondary" disabled={form.submitting} onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}

function EmailForm({ onUser, onDone }) {
  const form = useForm({ email: '', password: '' }, (v) => ({ email: emailError(v.email), password: v.password ? '' : 'Enter your current password.' }));
  const submit = form.handleSubmit(async (v) => {
    const data = await api('/profile/email', { method: 'POST', body: v });
    onUser(data.user);
    onDone(data.message);
  });
  return (
    <form className="form" onSubmit={submit} noValidate>
      {form.formError && <Alert tone="error" role="alert">{form.formError}</Alert>}
      <Field label="New email" type="email" autoComplete="email" {...form.bind('email')} />
      <Field label="Current password" type="password" autoComplete="current-password" hint="Needed to confirm it is you. We email a link to the new address; your email changes only after you open it." {...form.bind('password')} />
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>{form.submitting ? 'Sending…' : 'Send confirmation link'}</button>
        <button type="button" className="btn btn-secondary" disabled={form.submitting} onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}

function AccountSection({ user, onUser }) {
  const [editing, setEditing] = useState(''); // '' | 'name' | 'email'
  const [notice, setNotice] = useState(null);
  const done = (message) => {
    setEditing('');
    setNotice(message ? { tone: 'success', text: message } : null);
  };
  return (
    <>
      <Photo user={user} onUser={onUser} />
      <Block title="Name and email">
        <Notice notice={notice} />
        <dl className="setting-rows">
          <div>
            <dt>Full name</dt>
            <dd>{editing === 'name' ? <NameForm user={user} onUser={onUser} onDone={done} /> : <><span>{user.name}</span><button type="button" className="btn btn-secondary" onClick={() => { setNotice(null); setEditing('name'); }}>Edit</button></>}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              {editing === 'email' ? <EmailForm onUser={onUser} onDone={done} /> : (
                <>
                  <span>{user.email}</span>
                  {!user.googleLinked && <button type="button" className="btn btn-secondary" onClick={() => { setNotice(null); setEditing('email'); }}>Change</button>}
                </>
              )}
            </dd>
          </div>
        </dl>
        {user.googleLinked && <p className="muted">Your email comes from your Google account, so it cannot be changed here.</p>}
        {user.pendingEmail && <Alert role="status">Waiting for you to confirm <strong>{user.pendingEmail}</strong>. Open the link we emailed there; until then <strong>{user.email}</strong> stays your email.</Alert>}
      </Block>
    </>
  );
}

function PasswordForm({ onUser }) {
  const [notice, run] = useSave(onUser);
  const form = useForm({ currentPassword: '', newPassword: '', confirm: '' }, (v) => ({
    currentPassword: v.currentPassword ? '' : 'Enter your current password.',
    newPassword: passwordError(v.newPassword),
    confirm: !v.confirm ? 'Confirm your new password.' : v.confirm !== v.newPassword ? 'Passwords do not match.' : '',
  }));
  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    await run(() => api('/profile/password', { method: 'POST', body: { currentPassword, newPassword } }));
    form.reset();
  });
  return (
    <form className="form" onSubmit={submit} noValidate>
      <Notice notice={notice} />
      {form.formError && <Alert tone="error" role="alert">{form.formError}</Alert>}
      <Field label="Current password" type="password" autoComplete="current-password" {...form.bind('currentPassword')} />
      <Field label="New password" type="password" autoComplete="new-password" hint={PASSWORD_HINT} {...form.bind('newPassword')} />
      <Field label="Confirm new password" type="password" autoComplete="new-password" {...form.bind('confirm')} />
      <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={form.submitting}>{form.submitting ? 'Saving…' : 'Change password'}</button></div>
    </form>
  );
}

function ResetByEmail({ email }) {
  const [state, setState] = useState({ busy: false, notice: null });
  const send = async () => {
    setState({ busy: true, notice: null });
    try {
      const data = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setState({ busy: false, notice: { tone: 'success', text: data.message } });
    } catch (err) {
      setState({ busy: false, notice: { tone: 'error', text: err.message } });
    }
  };
  return (
    <>
      <p className="muted">Prefer not to type your current password? We can email a reset link to {email}.</p>
      <div><button type="button" className="btn btn-secondary" onClick={send} disabled={state.busy}>{state.busy ? 'Sending…' : 'Email me a reset link'}</button></div>
      <Notice notice={state.notice} />
    </>
  );
}

function SecuritySection({ user, onUser }) {
  return (
    <>
      <Block title="Sign-in methods">
        <dl className="setting-rows">
          <div><dt>Password</dt><dd><span>{user.hasPassword ? 'Set' : 'Not set'}</span></dd></div>
          <div><dt>Google</dt><dd><span className={`status ${user.googleLinked ? 'status-ok' : ''}`}>{user.googleLinked && <Icon name="check" size={16} />}{user.googleLinked ? 'Connected' : 'Not connected'}</span></dd></div>
        </dl>
      </Block>
      {user.hasPassword ? (
        <Block title="Change password">
          <PasswordForm onUser={onUser} />
          <ResetByEmail email={user.email} />
        </Block>
      ) : (
        <Block title="Password"><Alert>You sign in with Google, so this account has no password to change or reset.</Alert></Block>
      )}
    </>
  );
}

const THEMES = [
  { value: 'system', label: 'System', hint: 'Follows your device or browser setting', icon: 'monitor' },
  { value: 'light', label: 'Light', hint: 'Always light', icon: 'sun' },
  { value: 'dark', label: 'Dark', hint: 'Always dark', icon: 'moon' },
];

function AppearanceSection() {
  const { preference, choose } = useTheme();
  return (
    <Block title="Theme">
      <fieldset className="choice-group">
        <legend className="sr-only">Theme</legend>
        {THEMES.map((t) => (
          <label key={t.value} className="choice">
            <input type="radio" name="theme" value={t.value} checked={preference === t.value} onChange={() => choose(t.value)} />
            <span><Icon name={t.icon} size={18} /><strong>{t.label}</strong><small>{t.hint}</small></span>
          </label>
        ))}
      </fieldset>
      <p className="muted">Saved in this browser only, so each device keeps its own theme.</p>
    </Block>
  );
}

function PreferencesSection({ user, onUser }) {
  const [notice, setNotice] = useState(null);
  const [values, setValues] = useState(user.preferences);
  const [busy, setBusy] = useState(false);
  const set = (name) => (e) => setValues({ ...values, [name]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      onUser((await api('/profile/preferences', { method: 'PUT', body: values })).user);
      setNotice({ tone: 'success', text: 'Preferences saved.' });
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Block title="Preferences">
      <form className="form" onSubmit={save}>
        <Notice notice={notice} />
        <dl className="setting-rows"><div><dt>Currency</dt><dd><span>Pakistani rupee (PKR, Rs)</span></dd></div></dl>
        <p className="muted">All amounts are recorded and shown in rupees. Other currencies and conversion are not supported.</p>
        <Field as="select" label="Default report period" value={values.reportPeriod} onChange={set('reportPeriod')} hint="What the Reports page opens with. Custom ranges are chosen on the Reports page.">
          <option value="month">Monthly (current month)</option>
          <option value="year">Yearly (current year)</option>
          <option value="all">All time</option>
        </Field>
        <Field as="select" label="Page to open after login" value={values.landingPage} onChange={set('landingPage')}>
          <option value="dashboard">Dashboard</option>
          <option value="transactions">Transactions</option>
          <option value="budgets">Budgets</option>
          <option value="reports">Reports</option>
        </Field>
        <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button></div>
      </form>
      <p className="muted">Saved to your account, so they follow you to other devices.</p>
    </Block>
  );
}

function DeleteAccount({ user, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [credential, setCredential] = useState('');
  const [googleError, setGoogleError] = useState('');
  const form = useForm({ password: '', confirmation: '' }, (v) => ({
    password: user.hasPassword && !v.password ? 'Enter your password.' : '',
    confirmation: v.confirmation === 'DELETE' ? '' : 'Type DELETE to confirm.',
  }));
  const submit = form.handleSubmit(async (v) => {
    if (!user.hasPassword && !credential) throw new Error('Confirm with your Google account first.');
    await api('/profile/delete', { method: 'POST', body: { password: user.hasPassword ? v.password : undefined, credential: credential || undefined, confirmation: v.confirmation } });
    onDeleted();
  });
  if (!open) return <div><button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>Delete my account…</button></div>;
  return (
    <form className="form" onSubmit={submit} noValidate aria-label="Delete account">
      <Alert tone="error" role="alert">This permanently deletes your account, transactions, budgets and profile picture. It cannot be undone. Export your data first if you want a copy.</Alert>
      {form.formError && <Alert tone="error" role="alert">{form.formError}</Alert>}
      {user.hasPassword ? (
        <Field label="Your password" type="password" autoComplete="current-password" {...form.bind('password')} />
      ) : (
        <>
          {googleError && <Alert tone="error" role="alert">{googleError}</Alert>}
          {credential ? <Alert tone="success" role="status">Confirmed with Google.</Alert> : <><p className="muted">Confirm it is you by signing in with Google again.</p><GoogleButton onError={setGoogleError} onCredential={setCredential} /></>}
        </>
      )}
      <Field label="Type DELETE to confirm" autoComplete="off" {...form.bind('confirmation')} />
      <div className="form-actions">
        <button type="submit" className="btn btn-danger" disabled={form.submitting}>{form.submitting ? 'Deleting…' : 'Permanently delete account'}</button>
        <button type="button" className="btn btn-secondary" disabled={form.submitting} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

function DataSection({ user, onDeleted }) {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    Promise.all([api('/transactions/summary'), api('/budgets')]).then(
      ([s, b]) => setCounts({ transactions: s.count, budgets: b.budgets.length }),
      (err) => setError(err.message),
    );
  }, []);
  const exportAll = async (format) => {
    setExporting(format);
    setError('');
    try {
      await download(`/reports/export.${format}?period=all`, `hostel-expense-report.${format}`);
    } catch (err) {
      setError(`The ${format.toUpperCase()} export failed: ${err.message}`);
    } finally {
      setExporting('');
    }
  };

  return (
    <>
      <Block title="Your data">
        {counts ? (
          <dl className="setting-rows">
            <div><dt>Transactions</dt><dd><span>{counts.transactions}</span></dd></div>
            <div><dt>Budgets</dt><dd><span>{counts.budgets}</span></dd></div>
            <div><dt>Member since</dt><dd><span>{new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</span></dd></div>
          </dl>
        ) : !error && <div role="status" aria-label="Loading your data"><span className="spinner" /></div>}
        {error && <Alert tone="error" role="alert">{error}</Alert>}
      </Block>
      <Block title="Export">
        <p className="muted">Download every transaction you have recorded. For a single month, year or range, use the <Link to="/app/reports">Reports</Link> page.</p>
        <div className="export-row">
          <button type="button" className="btn btn-secondary" disabled={Boolean(exporting)} onClick={() => exportAll('csv')}><Icon name="download" size={16} />{exporting === 'csv' ? 'Preparing CSV…' : 'Export all as CSV'}</button>
          <button type="button" className="btn btn-secondary" disabled={Boolean(exporting)} onClick={() => exportAll('pdf')}><Icon name="download" size={16} />{exporting === 'pdf' ? 'Preparing PDF…' : 'Export all as PDF'}</button>
        </div>
      </Block>
      <Block title="Delete account">
        <DeleteAccount user={user} onDeleted={onDeleted} />
      </Block>
    </>
  );
}

export default function Settings() {
  usePageTitle('Settings');
  const { user, updateUser, forget } = useAuth();
  const [params] = useSearchParams();
  const current = SECTIONS.find((s) => s.id === params.get('section'))?.id ?? 'account';
  const body = {
    account: <AccountSection user={user} onUser={updateUser} />,
    security: <SecuritySection user={user} onUser={updateUser} />,
    appearance: <AppearanceSection />,
    preferences: <PreferencesSection user={user} onUser={updateUser} />,
    data: <DataSection user={user} onDeleted={forget} />,
  }[current];

  return (
    <>
      <h1>Settings</h1>
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}><Link to={`?section=${s.id}`} replace aria-current={s.id === current ? 'page' : undefined}>{s.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="settings-body card">
          <h2>{SECTIONS.find((s) => s.id === current).label}</h2>
          {body}
        </div>
      </div>
    </>
  );
}
