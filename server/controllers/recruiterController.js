/**
 * Recruiter Controller
 * Includes email verification via Abstract API after CSV/Excel import.
 */
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const Recruiter = require('../models/Recruiter');
const FailedEmail = require('../models/FailedEmail');
const { paginate, paginationMeta, isValidEmail } = require('../utils/helpers');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const {
  verifyBatch,
  toVerificationStatus,
  shouldSaveRecruiter
} = require('../services/emailVerificationService');

// ── GET /api/recruiters ─────────────────────────────────────────────────────
exports.getRecruiters = async (req, res, next) => {
  try {
    const {
      search, status, tags, favorite,
      page = 1, limit = 10,
      sortBy = 'createdAt', sortOrder = 'desc',
      verificationStatus
    } = req.query;

    const query = { user: req.user.id };

    if (search) {
      query.$or = [
        { name:    { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { email:   { $regex: search, $options: 'i' } },
        { role:    { $regex: search, $options: 'i' } }
      ];
    }

    if (status)             query.status             = status;
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (tags)               query.tags               = { $in: tags.split(',') };
    if (favorite === 'true') query.isFavorite         = true;

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const { skip, limit: lim } = paginate(query, page, limit);
    const total      = await Recruiter.countDocuments(query);
    const recruiters = await Recruiter.find(query).sort(sort).skip(skip).limit(lim);

    res.json({ success: true, data: recruiters, pagination: paginationMeta(total, page, lim) });
  } catch (error) { next(error); }
};

// ── GET /api/recruiters/:id ─────────────────────────────────────────────────
exports.getRecruiter = async (req, res, next) => {
  try {
    const recruiter = await Recruiter.findOne({ _id: req.params.id, user: req.user.id });
    if (!recruiter) return res.status(404).json({ success: false, message: 'Recruiter not found' });
    res.json({ success: true, data: recruiter });
  } catch (error) { next(error); }
};

// ── POST /api/recruiters ────────────────────────────────────────────────────
exports.createRecruiter = async (req, res, next) => {
  try {
    const { name, company, email, role, linkedin, location, notes, tags } = req.body;

    const existing = await Recruiter.findOne({ user: req.user.id, email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: `Recruiter with email ${email} already exists` });
    }

    const recruiter = await Recruiter.create({
      user: req.user.id, name, company, email, role, linkedin, location, notes,
      tags: tags || [], source: 'manual',
      verificationStatus: 'SKIPPED', isValid: true
    });

    res.status(201).json({ success: true, data: recruiter });
  } catch (error) { next(error); }
};

// ── PUT /api/recruiters/:id ─────────────────────────────────────────────────
exports.updateRecruiter = async (req, res, next) => {
  try {
    const recruiter = await Recruiter.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!recruiter) return res.status(404).json({ success: false, message: 'Recruiter not found' });
    res.json({ success: true, data: recruiter });
  } catch (error) { next(error); }
};

// ── DELETE /api/recruiters/:id ──────────────────────────────────────────────
exports.deleteRecruiter = async (req, res, next) => {
  try {
    const recruiter = await Recruiter.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!recruiter) return res.status(404).json({ success: false, message: 'Recruiter not found' });
    res.json({ success: true, message: 'Recruiter deleted' });
  } catch (error) { next(error); }
};

// ── PATCH /api/recruiters/:id/favorite ─────────────────────────────────────
exports.toggleFavorite = async (req, res, next) => {
  try {
    const recruiter = await Recruiter.findOne({ _id: req.params.id, user: req.user.id });
    if (!recruiter) return res.status(404).json({ success: false, message: 'Recruiter not found' });
    recruiter.isFavorite = !recruiter.isFavorite;
    await recruiter.save();
    res.json({ success: true, data: recruiter });
  } catch (error) { next(error); }
};

// ── POST /api/recruiters/upload ─────────────────────────────────────────────
exports.uploadRecruiters = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const ext     = path.extname(req.file.originalname).toLowerCase();
    const batchId = uuidv4();
    let rows = [];

    if (ext === '.csv') {
      rows = await parseCSV(req.file.path);
    } else if (ext === '.xlsx' || ext === '.xls') {
      rows = parseExcel(req.file.path);
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file type' });
    }

    // Clean up temp file immediately
    fs.unlink(req.file.path, () => {});

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data found in file' });
    }

    const source = ext === '.csv' ? 'csv' : 'excel';

    // ── Step 1: Parse & basic-validate every row ──────────
    const validRows  = [];
    const parseErrors = [];

    for (const row of rows) {
      const name     = (row['Recruiter Name'] || row['name']     || row['Name']     || '').trim();
      const company  = (row['Company']        || row['company']                     || '').trim();
      const email    = (row['Email']          || row['email']                       || '').trim().toLowerCase();
      const role     = (row['Role']           || row['role']     || row['Position'] || '').trim();
      const linkedin = (row['LinkedIn']       || row['linkedin']                    || '').trim();
      const location = (row['Location']       || row['location']                   || '').trim();
      const notes    = (row['Notes']          || row['notes']                       || '').trim();

      if (!email || !isValidEmail(email)) {
        parseErrors.push({ row: name || email || '(empty)', reason: 'Invalid or missing email' });
        continue;
      }
      // name is optional — fall back to email prefix if blank
      const resolvedName = name || email.split('@')[0];
      if (!company) {
        parseErrors.push({ row: email, reason: 'Missing company name' });
        continue;
      }

      validRows.push({ name: resolvedName, company, email, role, linkedin, location, notes });
    }

    // ── Step 2: Abstract API email verification (batch) ───
    const hasApiKey = !!process.env.ABSTRACT_API_KEY;
    let verificationMap = new Map(); // email → result

    if (hasApiKey && validRows.length > 0) {
      const emails = validRows.map(r => r.email);
      logger.info(`Verifying ${emails.length} emails via Abstract API (batch ${batchId})`);
      verificationMap = await verifyBatch(emails, { batchSize: 5, delayMs: 1200 });
    }

    // ── Step 3: Save / reject based on verification ───────
    const results = {
      total:          rows.length,
      imported:       0,
      deliverable:    0,
      undeliverable:  0,
      needsReview:    0,
      duplicates:     0,
      invalid:        parseErrors.length,
      skippedVerification: !hasApiKey,
      errors:         [...parseErrors]
    };

    const verifiedAt = new Date();

    for (const row of validRows) {
      const vResult = verificationMap.get(row.email) || { deliverability: 'SKIPPED' };
      const deliverability    = vResult.deliverability;  // DELIVERABLE | UNDELIVERABLE | RISKY | UNKNOWN | SKIPPED
      const verificationStatus = toVerificationStatus(deliverability);

      if (!shouldSaveRecruiter(deliverability)) {
        // ── UNDELIVERABLE → FailedEmail collection ────────
        results.undeliverable++;
        results.errors.push({ row: row.email, reason: `Undeliverable Email (Abstract API)` });

        try {
          await FailedEmail.create({
            user:               req.user.id,
            ...row,
            failureReason:      'Undeliverable Email',
            failureSource:      'verification',
            verificationStatus: 'UNDELIVERABLE',
            verificationRaw:    vResult.raw || null,
            verifiedAt,
            importBatch:        batchId,
            source
          });
        } catch (fe) {
          logger.error(`FailedEmail create error for ${row.email}: ${fe.message}`);
        }
        continue;
      }

      // RISKY or UNKNOWN → save but flag for review
      if (deliverability === 'RISKY' || deliverability === 'UNKNOWN') {
        results.needsReview++;
      }

      // ── Save to Recruiters ─────────────────────────────
      try {
        await Recruiter.create({
          user:               req.user.id,
          ...row,
          isValid:            true,
          verificationStatus,
          verifiedAt,
          importBatch:        batchId,
          source
        });

        results.imported++;
        if (deliverability === 'DELIVERABLE' || deliverability === 'SKIPPED') {
          results.deliverable++;
        }
      } catch (err) {
        if (err.code === 11000) {
          results.duplicates++;
        } else {
          results.errors.push({ row: row.email, reason: err.message });
          results.invalid++;
        }
      }
    }

    logger.info(
      `Import batch ${batchId}: ${results.imported} imported, ` +
      `${results.undeliverable} undeliverable, ${results.needsReview} needs-review, ` +
      `${results.duplicates} duplicates, ${results.invalid} invalid`
    );

    // ── Build human-readable summary message ──────────────
    let message = `Import complete: ${results.imported} recruiters imported`;
    if (results.undeliverable > 0) {
      message += `, ${results.undeliverable} undeliverable email${results.undeliverable > 1 ? 's' : ''} moved to Failed Emails`;
    }
    if (results.needsReview > 0) {
      message += `, ${results.needsReview} require${results.needsReview === 1 ? 's' : ''} review`;
    }
    if (results.duplicates > 0) {
      message += `, ${results.duplicates} duplicate${results.duplicates > 1 ? 's' : ''} skipped`;
    }
    if (!hasApiKey) {
      message += '. (Email verification skipped — add ABSTRACT_API_KEY to .env to enable it)';
    }

    res.json({
      success: true,
      message,
      data: results,
      batchId,
      verificationEnabled: hasApiKey
    });
  } catch (error) {
    next(error);
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end',  () => resolve(rows))
      .on('error', reject);
  });
}

function parseExcel(filePath) {
  const workbook  = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

// ── GET /api/recruiters/export ──────────────────────────────────────────────
exports.exportRecruiters = async (req, res, next) => {
  try {
    const recruiters = await Recruiter.find({ user: req.user.id });
    const ws = xlsx.utils.json_to_sheet(
      recruiters.map(r => ({
        'Recruiter Name':      r.name,
        'Company':             r.company,
        'Email':               r.email,
        'Role':                r.role,
        'LinkedIn':            r.linkedin,
        'Location':            r.location,
        'Status':              r.status,
        'Verification Status': r.verificationStatus,
        'Notes':               r.notes,
        'Tags':                r.tags.join(', '),
        'Created':             r.createdAt
      }))
    );
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Recruiters');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=recruiters.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) { next(error); }
};
