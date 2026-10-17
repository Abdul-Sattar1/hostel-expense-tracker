import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import Avatar from '../models/Avatar.js';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { verifyGoogleToken } from '../services/google.js';
import { sendVerificationEmail } from '../services/mailer.js';
import { clearSession } from '../services/session.js';
import { hashToken, randomToken } from '../services/tokens.js';

// Everything here acts on req.user (from the verified session), never on an id from the client.
// Responses carry the refreshed user so the client can update immediately.
const current = (req) => User.findById(req.user.id).select('+passwordHash');
const fieldError = (field, message, status = 400) => new HttpError(status, 'Please correct the highlighted fields.', { [field]: message });
const VERIFY_MINUTES = 60;
const CLEAR_RESET = { resetTokenHash: '', resetTokenExpires: '' };

export async function updateProfile(req, res) {
  await User.updateOne({ _id: req.user.id }, { $set: { name: req.body.name } });
  res.json({ user: await current(req) });
}

// Google accounts get their address from Google, so it is not editable here. Password accounts must
// re-enter their password; the new address is only stored as pending until its emailed link is used.
export async function requestEmailChange(req, res) {
  const { email, password } = req.body;
  if (req.user.googleId) throw new HttpError(403, 'Your email address comes from your Google account and cannot be changed here.');
  if (!req.user.passwordHash || !(await bcrypt.compare(password ?? '', req.user.passwordHash))) throw fieldError('password', 'Incorrect password.');
  if (email === req.user.email) throw fieldError('email', 'This is already your email address.');
  if (await User.findOne({ email })) throw fieldError('email', 'That email address is already in use.', 409);

  const token = randomToken();
  await User.updateOne({ _id: req.user.id }, { $set: { pendingEmail: email, pendingEmailHash: hashToken(token), pendingEmailExpires: new Date(Date.now() + VERIFY_MINUTES * 60 * 1000) } });
  try {
    await sendVerificationEmail(email, `${env.appUrl}/verify-email?token=${token}`, VERIFY_MINUTES);
  } catch (err) {
    console.error('Verification email failed:', err.message);
    await User.updateOne({ _id: req.user.id }, { $unset: { pendingEmail: '', pendingEmailHash: '', pendingEmailExpires: '' } });
    throw new HttpError(503, 'We could not send the verification email. Please try again later.');
  }
  res.json({ message: `We sent a confirmation link to ${email}. Your email stays unchanged until you open it (valid for ${VERIFY_MINUTES} minutes).`, user: await current(req) });
}

// Possession of the emailed token proves control of the new mailbox, so no session is required.
// The update is conditioned on the same token hash, so the link works once.
export async function verifyEmail(req, res) {
  const hash = hashToken(req.body.token);
  const invalid = new HttpError(400, 'This confirmation link is invalid or has expired. Request the change again from your profile.');
  const user = await User.findOne({ pendingEmailHash: hash, pendingEmailExpires: { $gt: new Date() } });
  if (!user?.pendingEmail) throw invalid;
  let result;
  try {
    result = await User.updateOne(
      { _id: user.id, pendingEmailHash: hash },
      { $set: { email: user.pendingEmail }, $unset: { pendingEmail: '', pendingEmailHash: '', pendingEmailExpires: '', ...CLEAR_RESET } },
    );
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'That email address is now used by another account.');
    throw err;
  }
  if (!result.modifiedCount) throw invalid;
  res.json({ message: 'Your email address has been updated.' });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!req.user.passwordHash) throw new HttpError(400, 'Your account uses Google sign-in and has no password to change.');
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) throw fieldError('currentPassword', 'Incorrect password.');
  if (await bcrypt.compare(newPassword, req.user.passwordHash)) throw fieldError('newPassword', 'Choose a password different from the current one.');
  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await User.updateOne({ _id: req.user.id }, { $set: { passwordHash }, $unset: CLEAR_RESET });
  res.json({ message: 'Your password has been changed.', user: await current(req) });
}

// Content is identified from the file's own signature, never from the filename or claimed MIME type.
function imageType(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function uploadAvatar(req, res) {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Choose an image file to upload.');
  const contentType = imageType(req.body);
  if (!contentType) throw new HttpError(415, 'Only JPEG, PNG or WebP images are allowed.');
  await Avatar.findOneAndUpdate({ owner: req.user.id }, { contentType, data: req.body }, { upsert: true });
  await User.updateOne({ _id: req.user.id }, { $set: { avatarUpdatedAt: new Date() } });
  res.json({ user: await current(req) });
}

export async function getAvatar(req, res) {
  const avatar = await Avatar.findOne({ owner: req.user.id });
  if (!avatar) throw new HttpError(404, 'No profile picture.');
  res.set({ 'Content-Type': avatar.contentType, 'Cache-Control': 'private, no-cache' });
  res.send(avatar.data);
}

export async function removeAvatar(req, res) {
  await Avatar.deleteOne({ owner: req.user.id });
  await User.updateOne({ _id: req.user.id }, { $unset: { avatarUpdatedAt: '' } });
  res.json({ user: await current(req) });
}

export async function updatePreferences(req, res) {
  await User.updateOne({ _id: req.user.id }, { $set: { preferences: req.body } });
  res.json({ user: await current(req) });
}

// Permanent. Needs the password (or a fresh Google sign-in for Google-only accounts) plus the typed
// confirmation. The user's own records go first and the account last, so a failure part-way leaves a
// still-usable account to retry from. Failed re-authentication is 400, never 401, so the session stays.
export async function deleteAccount(req, res) {
  if (req.user.passwordHash) {
    if (!(await bcrypt.compare(req.body.password ?? '', req.user.passwordHash))) throw fieldError('password', 'Incorrect password.');
  } else {
    const profile = await verifyGoogleToken(req.body.credential ?? '').catch(() => null);
    if (!profile || profile.id !== req.user.googleId) throw new HttpError(400, 'Please confirm with your Google account to delete this account.');
  }
  const owner = req.user.id;
  await Transaction.deleteMany({ owner });
  await Budget.deleteMany({ owner });
  await Avatar.deleteOne({ owner });
  await User.deleteOne({ _id: owner });
  clearSession(res);
  res.json({ message: 'Your account and all its data have been deleted.' });
}
