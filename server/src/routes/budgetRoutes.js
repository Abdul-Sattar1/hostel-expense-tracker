import { Router } from 'express';
import { create, get, list, remove, update } from '../controllers/budgetController.js';
import { checkId } from '../controllers/transactionController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireReady } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { budgetSchema } from '../validators/budget.js';

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireReady, requireAuth);
router.param('id', checkId);
router.get('/', list);
router.post('/', validate(budgetSchema), create);
router.get('/:id', get);
router.patch('/:id', validate(budgetSchema), update);
router.delete('/:id', remove);

export default router;
