/**
 * Resume Controller
 */
const path = require('path');
const fs = require('fs');
const Resume = require('../models/Resume');
const EmailTemplate = require('../models/EmailTemplate');
const { formatFileSize } = require('../utils/helpers');

// @desc   Upload resume
// @route  POST /api/resume/upload
exports.uploadResume = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // Find old active resume BEFORE deactivating (so we can delete its file)
    const oldResume = await Resume.findOne({ user: req.user.id, isActive: true });

    // Deactivate any existing resumes for this user
    await Resume.updateMany({ user: req.user.id }, { isActive: false });

    // Delete old resume file from disk
    if (oldResume && fs.existsSync(oldResume.path)) {
      fs.unlinkSync(oldResume.path);
    }

    const resume = await Resume.create({
      user: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      isActive: true
    });

    // Mark existing email template as stale by clearing its resumeHash.
    // The Email Template page detects the null hash mismatch and prompts
    // the user to regenerate — no automatic OpenAI call is made here.
    await EmailTemplate.updateMany(
      { user: req.user.id, isActive: true },
      { $set: { resumeHash: null } }
    );

    res.status(201).json({
      success: true,
      message: 'Resume uploaded successfully',
      data: {
        ...resume.toObject(),
        url: `/uploads/resume/${resume.filename}`,
        sizeFormatted: formatFileSize(resume.size)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Get active resume
// @route  GET /api/resume
exports.getResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ user: req.user.id, isActive: true });
    if (!resume) return res.json({ success: true, data: null });

    res.json({
      success: true,
      data: {
        ...resume.toObject(),
        url: `/uploads/resume/${resume.filename}`,
        sizeFormatted: formatFileSize(resume.size)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Delete resume
// @route  DELETE /api/resume
exports.deleteResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ user: req.user.id, isActive: true });
    if (!resume) return res.status(404).json({ success: false, message: 'No active resume found' });

    // Delete file from disk
    if (fs.existsSync(resume.path)) {
      fs.unlinkSync(resume.path);
    }

    await Resume.findByIdAndDelete(resume._id);
    res.json({ success: true, message: 'Resume deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc   Get resume file path (internal use)
exports.getResumePath = async (userId) => {
  const resume = await Resume.findOne({ user: userId, isActive: true });
  return resume ? resume.path : null;
};
