import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const COOKIE = 'token';
const DAYS = 7;
const cookieOptions = () => ({ httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/' });

export function issueSession(res, user) {
  const token = jwt.sign({}, env.jwtSecret, { subject: String(user.id), expiresIn: `${DAYS}d`, algorithm: 'HS256' });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: DAYS * 24 * 60 * 60 * 1000 });
}

export const clearSession = (res) => res.clearCookie(COOKIE, cookieOptions());

// Returns the user id from a valid, unexpired token, otherwise null.
export function readSession(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }).sub ?? null;
  } catch {
    return null;
  }
}
