/**
 * Draft Controller
 */
const Draft = require('../models/Draft');
const { paginate, paginationMeta } = require('../utils/helpers');

// @desc   Get all drafts for user
// @route  GET /api/drafts
exports.getDrafts = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { user: req.user.id };

    // Support comma-separated statuses, e.g. status=draft,failed
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    const { skip, limit: lim } = paginate(query, page, limit);
    const total  = await Draft.countDocuments(query);
    const drafts = await Draft.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('recruiter', 'name company email role');

    res.json({ success: true, data: drafts, pagination: paginationMeta(total, page, lim) });
  } catch (error) {
    next(error);
  }
};

// @desc   Get count of failed drafts
// @route  GET /api/drafts/failed-count
exports.getFailedCount = async (req, res, next) => {
  try {
    const count = await Draft.countDocuments({ user: req.user.id, status: 'failed' });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

// @desc   Reset all failed drafts back to 'draft' so they can be retried
// @route  POST /api/drafts/reset-failed
exports.resetFailed = async (req, res, next) => {
  try {
    const result = await Draft.updateMany(
      { user: req.user.id, status: 'failed' },
      { $set: { status: 'draft', lastError: null } }
    );
    res.json({
      success: true,
      message: `${result.modifiedCount} failed draft${result.modifiedCount !== 1 ? 's' : ''} reset — ready to resend`,
      data: { reset: result.modifiedCount }
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Get single draft
// @route  GET /api/drafts/:id
exports.getDraft = async (req, res, next) => {
  try {
    const draft = await Draft.findOne({ _id: req.params.id, user: req.user.id })
      .populate('recruiter', 'name company email role linkedin location');
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, data: draft });
  } catch (error) {
    next(error);
  }
};

// @desc   Update draft
// @route  PUT /api/drafts/:id
exports.updateDraft = async (req, res, next) => {
  try {
    const { subject, body, signature } = req.body;
    const draft = await Draft.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { subject, body, signature, autoSavedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('recruiter', 'name company email role');

    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, data: draft });
  } catch (error) {
    next(error);
  }
};

// @desc   Auto-save draft
// @route  PATCH /api/drafts/:id/autosave
exports.autoSave = async (req, res, next) => {
  try {
    const { subject, body, signature } = req.body;
    await Draft.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { subject, body, signature, autoSavedAt: new Date() }
    );
    res.json({ success: true, message: 'Auto-saved' });
  } catch (error) {
    next(error);
  }
};

// @desc   Delete draft
// @route  DELETE /api/drafts/:id
exports.deleteDraft = async (req, res, next) => {
  try {
    const draft = await Draft.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, message: 'Draft deleted' });
  } catch (error) {
    next(error);
  }
};
