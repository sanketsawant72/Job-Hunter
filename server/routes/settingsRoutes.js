const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, updateApiKey, fixSignature } = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getSettings);
router.put('/', updateSettings);
router.put('/api-key', updateApiKey);
router.post('/fix-signature', fixSignature);

module.exports = router;
