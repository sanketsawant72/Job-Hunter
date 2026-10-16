const express = require('express');
const router = express.Router();
const { generateEmail, generateBatch, generateForNew } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

router.use(protect);
router.post('/generate', [
  body('recruiterId').notEmpty().withMessage('recruiterId is required')
], validate, generateEmail);
router.post('/generate-batch', [
  body('recruiterIds').isArray({ min: 1 }).withMessage('recruiterIds must be a non-empty array')
], validate, generateBatch);
router.post('/generate-for-new', generateForNew);

module.exports = router;
