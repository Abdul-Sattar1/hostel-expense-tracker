import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import User from '../models/User.js';
import { verifyGoogleToken } from '../services/google.js';
import { sendResetEmail } from '../services/mailer.js';
import { clearSession, issueSession } from '../services/session.js';
import { hashToken, randomToken } from '../services/tokens.js';

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.bcryptRounds);

export async function register(req, res) {
  const { name, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  let user;
  try {
    user = await User.create({ name, email, passwordHash });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'An account with this email already exists.');
    throw err;
  }
  issueSession(res, user);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !valid) throw new HttpError(401, 'Incorrect email or password.');
  issueSession(res, user);
  res.json({ user });
}

export function logout(_req, res) {
  clearSession(res);
  res.json({ message: 'Logged out.' });
}

export const me = (req, res) => res.json({ user: req.user });

const EXISTS = 'An account with this email already exists. Log in with your email and password.';

// The ID token is verified by Google's library (signature, audience, expiry) before anything in it is used.
export async function google(req, res) {
  let profile;
  try {
    profile = await verifyGoogleToken(req.body.credential);
  } catch {
    throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
  }
  if (!profile.emailVerified || !profile.email) throw new HttpError(401, 'Your Google email address is not verified.');

  let user = await User.findOne({ googleId: profile.id });
  if (!user) {
    // Never auto-link: our email/password accounts have unverified emails, so a matching email
    // is not proof that the same person owns both.
    if (await User.findOne({ email: profile.email })) throw new HttpError(409, EXISTS);
    const name = (profile.name || profile.email.split('@')[0]).trim().slice(0, 80);
    try {
      user = await User.create({ name: name.length >= 2 ? name : profile.email, email: profile.email, googleId: profile.id });
    } catch (err) {
      if (err.code === 11000) throw new HttpError(409, EXISTS);
      throw err;
    }
  }
  issueSession(res, user);
  res.json({ user });
}

const RESET_MINUTES = 20;

// Same response whether or not the account exists. Mail is sent in the background so response time
// does not reveal it either. Google-only accounts (no password) are skipped.
export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (user?.passwordHash) {
    const token = randomToken();
    await User.updateOne({ _id: user.id }, { $set: { resetTokenHash: hashToken(token), resetTokenExpires: new Date(Date.now() + RESET_MINUTES * 60 * 1000) } });
    sendResetEmail(user.email, `${env.appUrl}/reset-password?token=${token}`, RESET_MINUTES).catch((err) => console.error('Reset email failed:', err.message));
  }
  res.json({ message: `If an account with a password exists for that email, a reset link has been sent. It expires in ${RESET_MINUTES} minutes.` });
}

// One atomic update: the token must match and be unexpired, and is cleared in the same step,
// so it works exactly once even if the link is submitted twice at the same moment.
export async function resetPassword(req, res) {
  const passwordHash = await bcrypt.hash(req.body.password, env.bcryptRounds);
  const user = await User.findOneAndUpdate(
    { resetTokenHash: hashToken(req.body.token), resetTokenExpires: { $gt: new Date() } },
    { $set: { passwordHash }, $unset: { resetTokenHash: '', resetTokenExpires: '' } },
  );
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  res.json({ message: 'Your password has been changed. You can now log in.' });
}
