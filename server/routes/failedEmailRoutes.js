const express = require('express');
const router  = express.Router();
const {
  getFailedEmails, getFailedEmail, updateFailedEmail,
  reverify, resolve, deleteFailedEmail, getStats
} = require('../controllers/failedEmailController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/stats',  getStats);
router.get('/',       getFailedEmails);
router.get('/:id',    getFailedEmail);
router.put('/:id',    updateFailedEmail);
router.post('/:id/reverify', reverify);
router.post('/:id/resolve',  resolve);
router.delete('/:id', deleteFailedEmail);

module.exports = router;
