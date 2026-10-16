/**
 * Recruiter Model
 */
const mongoose = require('mongoose');

const recruiterSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  role:     { type: String, trim: true, default: '' },
  linkedin: { type: String, trim: true, default: '' },
  location: { type: String, trim: true, default: '' },
  notes:    { type: String, default: '' },
  tags:     [{ type: String, trim: true }],
  isFavorite: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['new', 'drafted', 'sent', 'replied', 'rejected'],
    default: 'new'
  },
  importBatch: { type: String, default: null },
  source: {
    type: String,
    enum: ['manual', 'csv', 'excel'],
    default: 'manual'
  },

  // ── Email verification fields (Abstract API) ────────────
  isValid: {
    type: Boolean,
    default: true   // true until proven otherwise
  },
  verificationStatus: {
    type: String,
    enum: ['DELIVERABLE', 'UNDELIVERABLE', 'RISKY', 'UNKNOWN', 'PENDING', 'SKIPPED'],
    default: 'PENDING'
  },
  verifiedAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });

// Compound index to prevent duplicate emails per user
recruiterSchema.index({ user: 1, email: 1 }, { unique: true });

// Only include valid (deliverable / needs-review) recruiters in AI generation
recruiterSchema.index({ user: 1, isValid: 1, status: 1 });

module.exports = mongoose.model('Recruiter', recruiterSchema);
