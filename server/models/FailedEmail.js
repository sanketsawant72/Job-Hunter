/**
 * Failed Email Model
 * Stores recruiters whose email addresses failed verification
 * or bounced during sending. Users can review, correct and re-verify.
 */
const mongoose = require('mongoose');

const failedEmailSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ── Recruiter details (copied from import row) ──────────
  name:     { type: String, default: '' },
  company:  { type: String, default: '' },
  email:    { type: String, required: true, trim: true, lowercase: true },
  role:     { type: String, default: '' },
  linkedin: { type: String, default: '' },
  location: { type: String, default: '' },
  notes:    { type: String, default: '' },

  // ── Failure metadata ────────────────────────────────────
  failureReason: {
    type: String,
    default: 'Undeliverable Email'
  },
  // Source of failure: 'verification' | 'bounce' | 'manual'
  failureSource: {
    type: String,
    enum: ['verification', 'bounce', 'manual'],
    default: 'verification'
  },

  // ── Abstract API verification result ────────────────────
  verificationStatus: {
    type: String,
    enum: ['DELIVERABLE', 'UNDELIVERABLE', 'RISKY', 'UNKNOWN', 'PENDING', 'SKIPPED'],
    default: 'UNDELIVERABLE'
  },
  verificationRaw: {
    // Full JSON response from Abstract API stored for audit
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },

  // ── Resolution tracking ─────────────────────────────────
  isResolved: { type: Boolean, default: false },
  resolvedAt: { type: Date, default: null },
  resolvedNote: { type: String, default: '' },

  // ── Import context ──────────────────────────────────────
  importBatch: { type: String, default: null },
  source:      { type: String, enum: ['csv', 'excel', 'manual'], default: 'csv' },

  // ── Linked draft (populated for send-failure records so we can resend) ──
  draftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Draft',
    default: null
  }

}, { timestamps: true });

failedEmailSchema.index({ user: 1, email: 1 });
failedEmailSchema.index({ user: 1, isResolved: 1 });

module.exports = mongoose.model('FailedEmail', failedEmailSchema);
