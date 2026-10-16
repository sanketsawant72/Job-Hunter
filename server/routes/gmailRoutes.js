const express = require('express');
const router = express.Router();
const {
  getAuthUrl, callback, disconnect, getStatus, createDraft, sendEmail, retryFailed, sendBulk, resendFailed
} = require('../controllers/gmailController');
const { protect } = require('../middleware/auth');

// OAuth callback does NOT require auth (Google redirects here)
router.get('/callback', callback);

router.use(protect);
router.get('/auth-url', getAuthUrl);
router.post('/disconnect', disconnect);
router.get('/status', getStatus);
router.post('/create-draft', createDraft);
router.post('/send', sendEmail);
router.post('/send-bulk', sendBulk);
router.post('/retry', retryFailed);
router.post('/resend-failed', resendFailed);

module.exports = router;
