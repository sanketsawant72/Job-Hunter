/**
 * Application History Model
 */
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recruiter',
    default: null
  },
  draft: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Draft',
    default: null
  },
  recruiterName: { type: String, required: true },
  company: { type: String, required: true },
  recruiterEmail: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  status: {
    type: String,
    enum: ['sent', 'replied', 'rejected', 'failed'],
    default: 'sent'
  },
  gmailMessageId: { type: String, default: null },
  gmailThreadId: { type: String, default: null },
  sentAt: { type: Date, default: Date.now },
  repliedAt: { type: Date, default: null },
  notes: { type: String, default: '' },
  timeline: [{
    event: { type: String },
    timestamp: { type: Date, default: Date.now },
    details: { type: String, default: '' }
  }]
}, { timestamps: true });

// Index for fast searching
applicationSchema.index({ user: 1, sentAt: -1 });
applicationSchema.index({ user: 1, status: 1 });
applicationSchema.index({ user: 1, company: 'text', recruiterName: 'text', subject: 'text' });

module.exports = mongoose.model('Application', applicationSchema);
