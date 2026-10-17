import express, { Router } from 'express';
import { changePassword, deleteAccount, updatePreferences, getAvatar, removeAvatar, requestEmailChange, updateProfile, uploadAvatar, verifyEmail } from '../controllers/profileController.js';
import { requireAuth } from '../middleware/auth.js';
import { accountLimiter, requireReady, verifyLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { deleteAccountSchema, emailChangeSchema, passwordChangeSchema, preferencesSchema, profileSchema, verifyEmailSchema } from '../validators/profile.js';

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireReady);
router.post('/email/verify', verifyLimiter, validate(verifyEmailSchema), verifyEmail);

router.use(requireAuth);
router.patch('/', validate(profileSchema), updateProfile);
router.put('/preferences', validate(preferencesSchema), updatePreferences);
router.post('/delete', accountLimiter, validate(deleteAccountSchema), deleteAccount);
router.post('/email', accountLimiter, validate(emailChangeSchema), requestEmailChange);
router.post('/password', accountLimiter, validate(passwordChangeSchema), changePassword);
router.get('/avatar', getAvatar);
// Raw image bytes (max 2 MB); the type is detected from the content in the controller.
router.put('/avatar', express.raw({ type: () => true, limit: '2mb' }), uploadAvatar);
router.delete('/avatar', removeAvatar);

export default router;
