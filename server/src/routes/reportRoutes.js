import { Router } from 'express';
import { csv, pdf, report } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireReady } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { reportQuery } from '../validators/report.js';

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireReady, requireAuth, validate(reportQuery, 'query'));
router.get('/', report);
router.get('/export.csv', csv);
router.get('/export.pdf', pdf);

export default router;
