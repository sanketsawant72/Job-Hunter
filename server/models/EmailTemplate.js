/**
 * EmailTemplate Model
 *
 * Stores ONE master job-application email per user.
 * Generated from the user's current resume via OpenAI (once).
 * Reused for ALL applications — no repeat API calls unless the
 * resume changes or the user explicitly requests regeneration.
 */
const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which resume this template was generated from
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      default: null,
    },

    // SHA-256 hash of the raw resume file — used to detect changes
    // so we never call OpenAI again for the same resume content.
    resumeHash: {
      type: String,
      default: null,
    },

    // The generated (or manually edited) email content
    subject: { type: String, required: true, trim: true },
    body:    { type: String, required: true },

    // Auto-incremented each time a NEW AI generation happens
    version: { type: Number, default: 1 },

    // Only one active template per user at any time
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Unique active template per user
emailTemplateSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
