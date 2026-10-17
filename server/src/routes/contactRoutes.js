import { Router } from 'express';
import { submit } from '../controllers/contactController.js';
import { contactLimiter, requireReady } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { contactSchema } from '../validators/contact.js';

const router = Router();

// Public (no login), so it is rate limited per IP and size limited by the schema.
router.post('/', contactLimiter, requireReady, validate(contactSchema), submit);

export default router;
