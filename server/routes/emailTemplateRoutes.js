const express    = require('express');
const router     = express.Router();
const { protect } = require('../middleware/auth');
const {
  getTemplate,
  generateTemplate,
  updateTemplate,
  saveManualTemplate,
} = require('../controllers/emailTemplateController');
const { body } = require('express-validator');
const validate  = require('../middleware/validate');

router.use(protect);

// GET  /api/email-template          → fetch current template + resume metadata
router.get('/', getTemplate);

// POST /api/email-template/generate → generate (or reuse) master email via AI
router.post(
  '/generate',
  [body('force').optional().isBoolean()],
  validate,
  generateTemplate
);

// POST /api/email-template/manual   → save a hand-written template (no AI)
router.post(
  '/manual',
  [
    body('subject').notEmpty().withMessage('subject is required'),
    body('body').notEmpty().withMessage('body is required'),
  ],
  validate,
  saveManualTemplate
);

// PUT  /api/email-template/:id      → edit existing template (no AI)
router.put(
  '/:id',
  [
    body('subject').optional().isString(),
    body('body').optional().isString(),
  ],
  validate,
  updateTemplate
);

module.exports = router;
