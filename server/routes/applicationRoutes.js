const express = require('express');
const router = express.Router();
const { getApplications, getApplication, updateApplication, exportApplications } = require('../controllers/applicationController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/export', exportApplications);
router.get('/', getApplications);
router.get('/:id', getApplication);
router.put('/:id', updateApplication);

module.exports = router;
