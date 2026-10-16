const express = require('express');
const router = express.Router();
const {
  getRecruiters, getRecruiter, createRecruiter, updateRecruiter,
  deleteRecruiter, uploadRecruiters, toggleFavorite, exportRecruiters
} = require('../controllers/recruiterController');
const { protect } = require('../middleware/auth');
const { uploadImport } = require('../middleware/upload');

router.use(protect);

router.get('/export', exportRecruiters);
router.post('/upload', uploadImport, uploadRecruiters);
router.get('/', getRecruiters);
router.post('/', createRecruiter);
router.get('/:id', getRecruiter);
router.put('/:id', updateRecruiter);
router.delete('/:id', deleteRecruiter);
router.patch('/:id/favorite', toggleFavorite);

module.exports = router;
