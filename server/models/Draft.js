/**
 * Email Draft Model
 */
const mongoose = require('mongoose');

const draftSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recruiter',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  signature: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'approved', 'sent', 'failed'],
    default: 'draft'
  },
  gmailDraftId: {
    type: String,
    default: null
  },
  gmailMessageId: {
    type: String,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String,
    default: null
  },
  resumeAttached: {
    type: Boolean,
    default: false
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  autoSavedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Draft', draftSchema);
