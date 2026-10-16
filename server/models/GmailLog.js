/**
 * Gmail Activity Log Model
 */
const mongoose = require('mongoose');

const gmailLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['connect', 'disconnect', 'create_draft', 'send', 'retry', 'error'],
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    required: true
  },
  recruiterEmail: { type: String, default: null },
  recruiterName: { type: String, default: null },
  company: { type: String, default: null },
  gmailMessageId: { type: String, default: null },
  error: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('GmailLog', gmailLogSchema);
