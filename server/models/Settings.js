/**
 * User Settings Model - Candidate profile & API keys
 */
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  // Candidate Profile
  candidateName: { type: String, default: '' },
  college: { type: String, default: '' },
  degree: { type: String, default: '' },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  skills: [{ type: String }],
  experience: { type: String, default: '' }, // years or description
  projects: { type: String, default: '' },
  github: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  portfolio: { type: String, default: '' },
  emailSignature: { type: String, default: '' },
  resumeSummary: { type: String, default: '' },

  // API Configuration
  openaiApiKey: { type: String, default: '' },

  // Google OAuth tokens (encrypted in practice)
  googleAccessToken: { type: String, default: null, select: false },
  googleRefreshToken: { type: String, default: null, select: false },
  googleTokenExpiry: { type: Date, default: null },
  gmailConnected: { type: Boolean, default: false },
  gmailEmail: { type: String, default: null },

  // Custom AI Prompt
  aiPromptTemplate: {
    type: String,
    default: ''  // Empty = use the built-in prompt in openaiService.js
  },

  // Notification preferences
  notifyOnReply: { type: Boolean, default: true },
  notifyOnSend: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
