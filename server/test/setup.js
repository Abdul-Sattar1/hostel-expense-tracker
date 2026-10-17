import crypto from 'node:crypto';
import { mock } from 'node:test';

export const SECRET = 'test-secret-'.padEnd(48, 'x');

// Starts the real Express app with the database layer replaced by an in-memory fake, so the
// route, validation, bcrypt, JWT, cookie and rate-limit code all run for real but no database
// (local or Atlas) is ever contacted. Config is read once at import, so env is set first.
export async function startApp({ authRateLimit = 1000, port = 0 } = {}) {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = SECRET;
  process.env.AUTH_RATE_LIMIT = String(authRateLimit);
  delete process.env.MONGODB_URI;

  const users = new Map();
  // google: stands in for Google's token verification; mails: the reset emails that would be sent.
  const control = { db: 'connected', failBudgets: false, mailFails: false, feedbackFails: false, mails: [], google: () => { throw new Error('invalid token'); } };
  // Mirrors the real model: the hash is only present when explicitly selected; toJSON is a safe whitelist.
  const view = (rec, withHash = false) => ({
    ...rec,
    passwordHash: withHash ? rec.passwordHash : undefined,
    toJSON: () => ({
      id: rec.id,
      name: rec.name,
      email: rec.email,
      createdAt: rec.createdAt,
      pendingEmail: rec.pendingEmail ?? null,
      hasPassword: Boolean(rec.passwordHash),
      googleLinked: Boolean(rec.googleId),
      avatarUpdatedAt: rec.avatarUpdatedAt ?? null,
      preferences: { reportPeriod: rec.preferences?.reportPeriod ?? 'month', landingPage: rec.preferences?.landingPage ?? 'dashboard' },
    }),
  });
  // Filter semantics used by the controllers: equality, `_id` -> id, and { $gt } for expiry dates.
  const matches = (rec, q) => Object.entries(q).every(([k, v]) => (v && typeof v === 'object' && '$gt' in v ? rec[k] > v.$gt : (k === '_id' ? rec.id : rec[k]) === v));
  const query = (run) => ({ select: async () => { const r = run(); return r ? view(r, true) : null; }, then: (ok, fail) => Promise.resolve(run()).then((r) => (r ? view(r) : null)).then(ok, fail) });
  const apply = (rec, { $set = {}, $unset = {} }) => {
    Object.assign(rec, $set);
    for (const k of Object.keys($unset)) delete rec[k];
  };
  const duplicate = (rec, data) => [...users.values()].some((u) => u.id !== rec?.id && ((data.email && u.email === data.email) || (data.googleId && u.googleId === data.googleId)));
  const FakeUser = {
    async create({ name, email, passwordHash, googleId }) {
      if (duplicate(null, { email, googleId })) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      const rec = { id: crypto.randomBytes(12).toString('hex'), name, email, passwordHash, googleId, createdAt: new Date().toISOString() };
      users.set(rec.id, rec);
      return view(rec);
    },
    findOne: (q) => query(() => [...users.values()].find((u) => matches(u, q))),
    findById: (id) => query(() => users.get(id)),
    async updateOne(q, update) {
      const rec = [...users.values()].find((u) => matches(u, q));
      if (!rec) return { modifiedCount: 0 };
      if (duplicate(rec, update.$set ?? {})) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      apply(rec, update);
      return { modifiedCount: 1 };
    },
    async deleteOne({ _id }) { users.delete(_id); },
    async findOneAndUpdate(q, update) {
      const rec = [...users.values()].find((u) => matches(u, q));
      if (!rec) return null;
      apply(rec, update);
      return view(rec);
    },
  };
  const avatars = new Map();
  const FakeAvatar = {
    async findOne({ owner }) { return avatars.get(owner) ?? null; },
    async findOneAndUpdate({ owner }, data) { avatars.set(owner, { owner, ...data }); },
    async deleteOne({ owner }) { avatars.delete(owner); },
  };
  // Same contract as the Transaction model; owner is compared as the plain string id.
  const transactions = new Map();
  const tview = (rec) => ({ ...rec, toJSON: () => ({ id: rec.id, type: rec.type, amount: rec.amount, category: rec.category, description: rec.description, date: rec.date.toISOString().slice(0, 10) }) });
  const FakeTransaction = {
    // Honours owner, type and a date range; awaitable directly or after .sort().
    find: ({ owner, type, date }) => {
      const rows = () => [...transactions.values()].filter((t) => t.owner === owner && (!type || t.type === type) && (!date || (t.date >= date.$gte && t.date < date.$lt)));
      return { sort: async () => rows().reverse().sort((a, b) => b.date - a.date).map(tview), then: (ok, fail) => Promise.resolve(rows().map(tview)).then(ok, fail) };
    },
    async deleteMany({ owner }) { for (const [id, t] of transactions) if (t.owner === owner) transactions.delete(id); },
    async findOne({ _id, owner }) { const t = transactions.get(_id); return t?.owner === owner ? tview(t) : null; },
    async create(data) {
      const rec = { id: crypto.randomBytes(12).toString('hex'), description: '', ...data };
      transactions.set(rec.id, rec);
      return tview(rec);
    },
    async findOneAndUpdate({ _id, owner }, data) {
      const t = transactions.get(_id);
      if (t?.owner !== owner) return null;
      Object.assign(t, data);
      return tview(t);
    },
    async findOneAndDelete({ _id, owner }) { const t = transactions.get(_id); if (t?.owner !== owner) return null; transactions.delete(_id); return tview(t); },
  };
  const budgets = new Map();
  const dup = () => Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  const taken = (owner, category, exceptId) => [...budgets.values()].some((b) => b.owner === owner && b.category === category && b.id !== exceptId);
  const FakeBudget = {
    find: ({ owner }) => ({ sort: async () => control.failBudgets ? Promise.reject(new Error('db down')) : [...budgets.values()].filter((b) => b.owner === owner).sort((a, b) => a.category.localeCompare(b.category)) }),
    async deleteMany({ owner }) { for (const [id, b] of budgets) if (b.owner === owner) budgets.delete(id); },
    async findOne({ _id, owner }) { const b = budgets.get(_id); return b?.owner === owner ? b : null; },
    async create(data) {
      if (taken(data.owner, data.category)) throw dup();
      const rec = { id: crypto.randomBytes(12).toString('hex'), ...data };
      budgets.set(rec.id, rec);
      return rec;
    },
    async findOneAndUpdate({ _id, owner }, data) {
      const b = budgets.get(_id);
      if (b?.owner !== owner) return null;
      if (taken(owner, data.category, _id)) throw dup();
      return Object.assign(b, data);
    },
    async findOneAndDelete({ _id, owner }) { const b = budgets.get(_id); if (b?.owner !== owner) return null; budgets.delete(_id); return b; },
  };
  mock.module('../src/models/Budget.js', { defaultExport: FakeBudget });
  mock.module('../src/models/Transaction.js', { defaultExport: FakeTransaction });
  mock.module('../src/models/User.js', { defaultExport: FakeUser });
  mock.module('../src/services/google.js', { exports: { verifyGoogleToken: async (credential) => control.google(credential) } });
  const sendMail = async (to, link) => {
    if (control.mailFails) throw new Error('SMTP down');
    control.mails.push({ to, link });
  };
  mock.module('../src/services/mailer.js', { exports: { sendResetEmail: sendMail, sendVerificationEmail: sendMail } });
  mock.module('../src/models/Avatar.js', { defaultExport: FakeAvatar });
  const feedback = [];
  mock.module('../src/models/Feedback.js', { defaultExport: { async create(data) { if (control.feedbackFails) throw new Error('db down'); feedback.push(data); } } });
  mock.module('../src/config/db.js', { exports: { dbState: () => control.db, connectDb: async () => {} } });

  const { createApp } = await import('../src/app.js');
  const server = createApp().listen(port);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://localhost:${server.address().port}`;

  const request = async (method, path, { body, cookie, headers } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }), ...headers },
      body: body === undefined || typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body),
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = buffer.toString('utf8');
    let json;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    const setCookie = res.headers.getSetCookie();
    return { status: res.status, json, text, buffer, headers: res.headers, setCookie, cacheControl: res.headers.get('cache-control'), cookie: setCookie.find((c) => c.startsWith('token='))?.split(';')[0] };
  };

  return { request, users, transactions, budgets, avatars, feedback, control, stop: () => server.close() };
}
