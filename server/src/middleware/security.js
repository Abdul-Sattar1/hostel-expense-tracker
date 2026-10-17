import rateLimit from 'express-rate-limit';
import { dbState } from '../config/db.js';
import { env } from '../config/env.js';

// CSRF defence for cookie auth, on top of SameSite=Lax: browsers always send Origin on
// cross-site POSTs, so a state-changing request from an untrusted origin is rejected.
export function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const allowed = [`${req.protocol}://${req.get('host')}`];
  if (!env.isProd) allowed.push(env.clientOrigin);
  if (allowed.includes(origin)) return next();
  res.status(403).json({ message: 'Request blocked: untrusted origin.' });
}

export function requireReady(_req, res, next) {
  if (dbState() === 'connected' && env.jwtSecret) return next();
  res.status(503).json({ message: 'The service is temporarily unavailable. Please try again later.' });
}

const limiter = (options) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.authRateLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many attempts. Please try again in a few minutes.' },
    ...options,
  });

export const googleLimiter = limiter({ skipSuccessfulRequests: true });
// Re-checking the current password (password / email change): only failures count.
export const accountLimiter = limiter({ skipSuccessfulRequests: true });
export const verifyLimiter = limiter();
export const contactLimiter = limiter();
export const forgotLimiter = limiter();
export const resetLimiter = limiter();
export const loginLimiter = limiter({ skipSuccessfulRequests: true });
export const registerLimiter = limiter();
