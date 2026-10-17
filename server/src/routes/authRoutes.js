import { Router } from 'express';
import { forgotPassword, google, login, logout, me, register, resetPassword } from '../controllers/authController.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { forgotLimiter, googleLimiter, loginLimiter, registerLimiter, requireReady, resetLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { forgotSchema, googleSchema, loginSchema, registerSchema, resetSchema } from '../validators/auth.js';

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
// The Google client id is public (it is embedded in the sign-in button); the secret is never used.
router.get('/config', (_req, res) => res.json({ googleClientId: env.googleClientId ?? null }));
router.post('/register', registerLimiter, requireReady, validate(registerSchema), register);
router.post('/login', loginLimiter, requireReady, validate(loginSchema), login);
router.post('/google', googleLimiter, requireReady, validate(googleSchema), google);
router.post('/forgot-password', forgotLimiter, requireReady, validate(forgotSchema), forgotPassword);
router.post('/reset-password', resetLimiter, requireReady, validate(resetSchema), resetPassword);
router.post('/logout', logout);
router.get('/me', requireReady, requireAuth, me);

export default router;
