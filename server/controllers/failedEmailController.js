/**
 * Failed Email Controller
 * Manage undeliverable emails: list, re-verify, resolve, delete.
 */
const FailedEmail  = require('../models/FailedEmail');
const Recruiter    = require('../models/Recruiter');
const { verifyEmail, toVerificationStatus, shouldSaveRecruiter } = require('../services/emailVerificationService');
const { paginate, paginationMeta, isValidEmail } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── GET /api/failed-emails ──────────────────────────────────────────────────
exports.getFailedEmails = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, isResolved, verificationStatus } = req.query;
    const query = { user: req.user.id };

    if (search) {
      query.$or = [
        { name:    { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { email:   { $regex: search, $options: 'i' } }
      ];
    }
    if (isResolved !== undefined) query.isResolved = isResolved === 'true';
    if (verificationStatus)       query.verificationStatus = verificationStatus;

    const { skip, limit: lim } = paginate(query, page, limit);
    const total  = await FailedEmail.countDocuments(query);
    const failed = await FailedEmail.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim);

    res.json({ success: true, data: failed, pagination: paginationMeta(total, page, lim) });
  } catch (error) { next(error); }
};

// ── GET /api/failed-emails/:id ──────────────────────────────────────────────
exports.getFailedEmail = async (req, res, next) => {
  try {
    const record = await FailedEmail.findOne({ _id: req.params.id, user: req.user.id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
};

// ── PUT /api/failed-emails/:id ──────────────────────────────────────────────
// Update email address (correct a typo) before re-verifying
exports.updateFailedEmail = async (req, res, next) => {
  try {
    const { email, name, company, role, linkedin, location, notes } = req.body;
    const update = {};
    if (email)    update.email    = email.trim().toLowerCase();
    if (name)     update.name     = name;
    if (company)  update.company  = company;
    if (role)     update.role     = role;
    if (linkedin) update.linkedin = linkedin;
    if (location) update.location = location;
    if (notes !== undefined) update.notes = notes;

    // Reset verification status so user can re-verify
    if (email) {
      update.verificationStatus = 'PENDING';
      update.verifiedAt         = null;
      update.isResolved         = false;
    }

    const record = await FailedEmail.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      update,
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
};

// ── POST /api/failed-emails/:id/reverify ────────────────────────────────────
exports.reverify = async (req, res, next) => {
  try {
    const record = await FailedEmail.findOne({ _id: req.params.id, user: req.user.id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    if (!isValidEmail(record.email)) {
      return res.status(400).json({ success: false, message: 'Email format is invalid. Please correct it first.' });
    }

    // Call Abstract API
    const vResult           = await verifyEmail(record.email);
    const deliverability    = vResult.deliverability;
    const verificationStatus = toVerificationStatus(deliverability);
    const verifiedAt         = new Date();

    // Update the failed email record
    record.verificationStatus = verificationStatus;
    record.verificationRaw    = vResult.raw || null;
    record.verifiedAt         = verifiedAt;

    if (shouldSaveRecruiter(deliverability)) {
      // ── Email is now valid → promote to Recruiters ──────
      const existing = await Recruiter.findOne({ user: req.user.id, email: record.email });
      if (!existing) {
        await Recruiter.create({
          user:               req.user.id,
          name:               record.name,
          company:            record.company,
          email:              record.email,
          role:               record.role,
          linkedin:           record.linkedin,
          location:           record.location,
          notes:              record.notes,
          isValid:            true,
          verificationStatus,
          verifiedAt,
          source:             record.source || 'csv'
        });
      } else {
        // Already exists — just update verification fields
        await Recruiter.findByIdAndUpdate(existing._id, { verificationStatus, verifiedAt, isValid: true });
      }

      record.isResolved  = true;
      record.resolvedAt  = new Date();
      record.resolvedNote = `Re-verified: ${deliverability}. Moved to Recruiters.`;
      await record.save();

      logger.info(`Re-verified ${record.email}: ${deliverability} → promoted to Recruiters`);

      return res.json({
        success: true,
        message: `Email verified as ${deliverability}. Recruiter has been added to your list.`,
        data: { deliverability, verificationStatus, promoted: true, record }
      });
    }

    // Still undeliverable
    await record.save();

    res.json({
      success: true,
      message: `Email is still ${deliverability}. No recruiter created.`,
      data: { deliverability, verificationStatus, promoted: false, record }
    });
  } catch (error) { next(error); }
};

// ── POST /api/failed-emails/:id/resolve ─────────────────────────────────────
// Manually mark as resolved (user decides to ignore)
exports.resolve = async (req, res, next) => {
  try {
    const { note } = req.body;
    const record = await FailedEmail.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isResolved: true, resolvedAt: new Date(), resolvedNote: note || 'Manually resolved' },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, message: 'Record resolved', data: record });
  } catch (error) { next(error); }
};

// ── DELETE /api/failed-emails/:id ───────────────────────────────────────────
exports.deleteFailedEmail = async (req, res, next) => {
  try {
    const record = await FailedEmail.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) { next(error); }
};

// ── GET /api/failed-emails/stats ─────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [total, unresolved, undeliverable, risky, unknown] = await Promise.all([
      FailedEmail.countDocuments({ user: req.user.id }),
      FailedEmail.countDocuments({ user: req.user.id, isResolved: false }),
      FailedEmail.countDocuments({ user: req.user.id, verificationStatus: 'UNDELIVERABLE' }),
      FailedEmail.countDocuments({ user: req.user.id, verificationStatus: 'RISKY' }),
      FailedEmail.countDocuments({ user: req.user.id, verificationStatus: 'UNKNOWN' })
    ]);
    res.json({ success: true, data: { total, unresolved, undeliverable, risky, unknown } });
  } catch (error) { next(error); }
};
