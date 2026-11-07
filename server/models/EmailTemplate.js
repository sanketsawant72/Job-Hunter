/**
 * EmailTemplate Model
 *
 * Stores reusable job-application master templates. The legacy roleCategory
 * field remains so existing MongoDB documents continue to load safely.
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

    roleCategory: {
      type: String,
      enum: ['web', 'java', 'ai', 'python', 'general'],
      default: 'general',
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

    // Application code keeps one active master template per user.
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

emailTemplateSchema.index({ user: 1, roleCategory: 1, isActive: 1 });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
