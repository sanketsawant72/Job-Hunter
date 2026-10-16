const express = require('express');
const router = express.Router();
const { uploadResume: upload, getResume, deleteResume } = require('../controllers/resumeController');
const { protect } = require('../middleware/auth');
const { uploadResume } = require('../middleware/upload');

router.use(protect);
router.post('/upload', uploadResume, upload);
router.get('/', getResume);
router.delete('/', deleteResume);

module.exports = router;
