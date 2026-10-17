import { Router } from 'express';
import { checkId, create, get, list, remove, summary, update } from '../controllers/transactionController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireReady } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { transactionSchema } from '../validators/transaction.js';

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireReady, requireAuth);
router.param('id', checkId);
router.get('/', list);
router.get('/summary', summary);
router.post('/', validate(transactionSchema), create);
router.get('/:id', get);
router.patch('/:id', validate(transactionSchema), update);
router.delete('/:id', remove);

export default router;
