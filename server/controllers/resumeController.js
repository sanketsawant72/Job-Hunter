/**
 * Resume Controller
 *
 * Upload is atomic:
 *   1. Verify the new file actually landed on disk before touching anything in the DB.
 *   2. Create the new Resume document first.
 *   3. Only then deactivate the old record and delete the old file.
 *
 * This prevents the "Resume file not found on disk" error caused by a
 * partial upload where the DB was updated but the file was never written.
 */
const fs = require('fs');
const Resume = require('../models/Resume');
const EmailTemplate = require('../models/EmailTemplate');
const { formatFileSize } = require('../utils/helpers');
const { getResumePath } = require('../utils/uploadPaths');
const logger = require('../utils/logger');

// @desc   Upload resume
// @route  POST /api/resume/upload
exports.uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // ── Step 1: Confirm the file actually landed on disk ─────────────────
    const newFilePath = req.file.path;
    if (!fs.existsSync(newFilePath)) {
      logger.error(`Upload middleware reported success but file not found: ${newFilePath}`);
      return res.status(500).json({
        success: false,
        message: 'File upload failed — the file was not saved to disk. Please try again.',
      });
    }

    // ── Step 2: Create new resume record BEFORE touching old data ────────
    const resume = await Resume.create({
      user        : req.user.id,
      filename    : req.file.filename,
      originalName: req.file.originalname,
      path        : req.file.path,
      mimetype    : req.file.mimetype,
      size        : req.file.size,
      isActive    : true,
    });

    // ── Step 3: Deactivate old records and delete old file ───────────────
    //   Do this AFTER the new record is safely in the DB so a crash here
    //   doesn't leave the user with no active resume.
    const oldResumes = await Resume.find({ user: req.user.id, isActive: true, _id: { $ne: resume._id } });
    if (oldResumes.length > 0) {
      await Resume.updateMany(
        { user: req.user.id, isActive: true, _id: { $ne: resume._id } },
        { isActive: false }
      );

      // Delete old files from disk (best-effort — don't fail if already gone)
      for (const old of oldResumes) {
        const oldPath = getResumePath(old);
        if (oldPath && fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) {
            logger.warn(`Could not delete old resume file ${oldPath}: ${e.message}`);
          }
        }
      }
    }

    // ── Step 4: Mark email template as stale ────────────────────────────
    await EmailTemplate.updateMany(
      { user: req.user.id, isActive: true },
      { $set: { resumeHash: null } }
    );

    logger.info(`Resume uploaded: ${resume.filename} for user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Resume uploaded successfully',
      data: {
        ...resume.toObject(),
        url          : `/uploads/resume/${resume.filename}`,
        sizeFormatted: formatFileSize(resume.size),
      },
    });
  } catch (error) {
    // Clean up the uploaded file if the DB write failed, so we don't leave orphans
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    next(error);
  }
};

// @desc   Get active resume
// @route  GET /api/resume
exports.getResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ user: req.user.id, isActive: true });
    if (!resume) return res.json({ success: true, data: null });

    // Self-heal: if the active record's file is missing but another inactive
    // record's file exists, swap them so the user doesn't get stuck.
    const resumePath = getResumePath(resume);
    if (resumePath && !fs.existsSync(resumePath)) {
      const candidates = await Resume.find({ user: req.user.id, isActive: false }).sort({ createdAt: -1 });
      for (const c of candidates) {
        const p = getResumePath(c);
        if (p && fs.existsSync(p)) {
          logger.warn(`Self-healing resume: swapping ${resume.filename} → ${c.filename} for user ${req.user.id}`);
          await Resume.findByIdAndUpdate(resume._id, { isActive: false });
          await Resume.findByIdAndUpdate(c._id, { isActive: true });
          const healed = await Resume.findById(c._id);
          return res.json({
            success: true,
            data: {
              ...healed.toObject(),
              url          : `/uploads/resume/${healed.filename}`,
              sizeFormatted: formatFileSize(healed.size),
            },
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...resume.toObject(),
        url          : `/uploads/resume/${resume.filename}`,
        sizeFormatted: formatFileSize(resume.size),
      },
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

    const resumePath = getResumePath(resume);
    if (resumePath && fs.existsSync(resumePath)) {
      fs.unlinkSync(resumePath);
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
  return getResumePath(resume);
};
