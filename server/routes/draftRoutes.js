const express = require('express');
const router  = express.Router();
const {
  getDrafts, getDraft, updateDraft, autoSave, deleteDraft,
  getFailedCount, resetFailed
} = require('../controllers/draftController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Specific routes before /:id
router.get('/failed-count', getFailedCount);
router.post('/reset-failed', resetFailed);

router.get('/',        getDrafts);
router.get('/:id',     getDraft);
router.put('/:id',     updateDraft);
router.patch('/:id/autosave', autoSave);
router.delete('/:id',  deleteDraft);

module.exports = router;
