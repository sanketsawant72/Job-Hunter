/**
 * Gmail Controller - Google OAuth2 & Gmail API
 */
const gmailService  = require('../services/gmailService');
const Settings      = require('../models/Settings');
const Draft         = require('../models/Draft');
const Application   = require('../models/Application');
const Recruiter     = require('../models/Recruiter');
const GmailLog      = require('../models/GmailLog');
const FailedEmail   = require('../models/FailedEmail');
const Resume        = require('../models/Resume');
const logger        = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a valid auth client — auto-refreshes token if expired.
 */
async function getAuthClient(settings, userId) {
  // Guard: no refresh token means user never properly connected Gmail
  if (!settings.googleRefreshToken) {
    const e = new Error('Gmail not properly connected — please reconnect Gmail');
    e.code = 401;
    throw e;
  }

  let accessToken = settings.googleAccessToken;
  const expiry    = settings.googleTokenExpiry ? new Date(settings.googleTokenExpiry) : null;
  const now       = new Date();

  // Refresh if expired or expiring within 2 minutes
  if (!accessToken || !expiry || expiry <= new Date(now.getTime() + 2 * 60 * 1000)) {
    logger.info(`Gmail token expired or missing for user ${userId} — refreshing`);
    accessToken = await gmailService.refreshAndSaveToken(userId, settings.googleRefreshToken);
  }

  return gmailService.buildAuthClient(accessToken, settings.googleRefreshToken, settings.googleTokenExpiry);
}

/**
 * Send one email with automatic retry on transient errors.
 * Auth errors (invalid_grant, insufficientPermissions) are NOT retried.
 * Network / rate-limit errors are retried up to maxRetries times with
 * exponential backoff.
 */
async function sendWithRetry({ authClient, draft, resume, maxRetries = 3 }) {
  const NON_RETRYABLE = ['invalid_grant', 'insufficientPermissions', 'Insufficient Permission'];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let result;
      if (draft.gmailDraftId) {
        result = await gmailService.sendDraft(authClient, draft.gmailDraftId);
      } else {
        result = await gmailService.sendEmail({
          authClient,
          to:         draft.recruiter.email,
          subject:    draft.subject,
          body:       draft.body + (draft.signature ? `\n\n${draft.signature}` : ''),
          resumePath: resume?.path         || null,
          resumeName: resume?.originalName || null
        });
      }
      return result;
    } catch (err) {
      const isNonRetryable = NON_RETRYABLE.some(msg => err.message?.includes(msg));
      if (isNonRetryable || attempt === maxRetries) throw err;

      const waitMs = 1000 * Math.pow(2, attempt);
      logger.warn(
        `Send attempt ${attempt}/${maxRetries} failed for ${draft.recruiter.email}: ` +
        `${err.message}. Retrying in ${waitMs}ms…`
      );
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

/**
 * Classify an error message into a human-readable reason string
 * and a FailedEmail.failureSource value.
 */
function classifyError(errorMessage) {
  const msg = (errorMessage || '').toLowerCase();

  if (msg.includes('invalid_grant') || msg.includes('token has been expired')) {
    return { reason: 'Gmail token expired — reconnect Gmail', source: 'bounce' };
  }
  if (msg.includes('insufficientpermissions') || msg.includes('insufficient permission')) {
    return { reason: 'Gmail permission denied — reconnect Gmail', source: 'bounce' };
  }
  if (msg.includes('invalid recipient') || msg.includes('address not found') || msg.includes('no such user')) {
    return { reason: 'Invalid recipient address', source: 'bounce' };
  }
  if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('too many')) {
    return { reason: 'Gmail send quota exceeded', source: 'bounce' };
  }
  return { reason: errorMessage || 'Send failed', source: 'bounce' };
}

/**
 * Record a failed send in the FailedEmail collection so the user
 * can see it on the Failed Emails page and retry.
 *
 * Uses upsert on (user + email) so re-sends don't duplicate records.
 */
async function recordFailedSend({ userId, draft, errorMessage }) {
  try {
    const { reason } = classifyError(errorMessage);
    const recruiter  = draft.recruiter;

    await FailedEmail.findOneAndUpdate(
      { user: userId, email: recruiter.email },
      {
        $set: {
          user:               userId,
          name:               recruiter.name    || '',
          company:            recruiter.company || '',
          email:              recruiter.email,
          role:               recruiter.role    || '',
          linkedin:           recruiter.linkedin || '',
          location:           recruiter.location || '',
          failureReason:      reason,
          failureSource:      'bounce',
          verificationStatus: 'UNKNOWN',
          isResolved:         false,
          resolvedAt:         null,
          // store the draft id so we can resend later
          draftId:            draft._id,
        }
      },
      { upsert: true, new: true }
    );

    logger.info(`Recorded failed send for ${recruiter.email}: ${reason}`);
  } catch (err) {
    // Non-fatal — log but don't let this break the send flow
    logger.error(`recordFailedSend error: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// routes
// ─────────────────────────────────────────────────────────────────────────────

// @desc   Get Gmail OAuth URL
// @route  GET /api/gmail/auth-url
exports.getAuthUrl = async (req, res, next) => {
  try {
    const url = gmailService.getAuthUrl(req.user.id);
    res.json({ success: true, url });
  } catch (error) { next(error); }
};

// @desc   Gmail OAuth2 callback
// @route  GET /api/gmail/callback
exports.callback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.redirect(`${process.env.CLIENT_URL}/gmail?error=no_code`);

    const tokens     = await gmailService.getTokensFromCode(code);
    const gmailEmail = await gmailService.getGmailEmail(tokens.access_token);

    await Settings.findOneAndUpdate(
      { user: state },
      {
        googleAccessToken:  tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry:  new Date(tokens.expiry_date),
        gmailConnected:     true,
        gmailEmail
      },
      { upsert: true }
    );

    await GmailLog.create({ user: state, action: 'connect', status: 'success', metadata: { email: gmailEmail } });
    logger.info(`Gmail connected for user ${state}: ${gmailEmail}`);
    res.redirect(`${process.env.CLIENT_URL}/gmail?connected=true&email=${encodeURIComponent(gmailEmail)}`);
  } catch (error) {
    logger.error(`Gmail callback error: ${error.message}`);
    res.redirect(`${process.env.CLIENT_URL}/gmail?error=${encodeURIComponent(error.message)}`);
  }
};

// @desc   Disconnect Gmail
// @route  POST /api/gmail/disconnect
exports.disconnect = async (req, res, next) => {
  try {
    await Settings.findOneAndUpdate(
      { user: req.user.id },
      { googleAccessToken: null, googleRefreshToken: null, gmailConnected: false, gmailEmail: null }
    );
    await GmailLog.create({ user: req.user.id, action: 'disconnect', status: 'success' });
    res.json({ success: true, message: 'Gmail disconnected' });
  } catch (error) { next(error); }
};

// @desc   Get Gmail connection status
// @route  GET /api/gmail/status
exports.getStatus = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ user: req.user.id })
      .select('gmailConnected gmailEmail googleTokenExpiry');
    res.json({
      success: true,
      data: {
        connected:   settings?.gmailConnected    || false,
        email:       settings?.gmailEmail        || null,
        tokenExpiry: settings?.googleTokenExpiry || null
      }
    });
  } catch (error) { next(error); }
};

// @desc   Create Gmail draft
// @route  POST /api/gmail/create-draft
exports.createDraft = async (req, res, next) => {
  try {
    const { draftId } = req.body;

    const settings = await Settings.findOne({ user: req.user.id }).select('+googleAccessToken +googleRefreshToken');
    if (!settings?.gmailConnected) {
      return res.status(400).json({ success: false, message: 'Gmail not connected. Please connect Gmail first.' });
    }

    const draft = await Draft.findOne({ _id: draftId, user: req.user.id }).populate('recruiter');
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    const resume     = await Resume.findOne({ user: req.user.id, isActive: true });
    const authClient = await getAuthClient(settings, req.user.id);

    const gmailDraftId = await gmailService.createDraft({
      authClient,
      to:         draft.recruiter.email,
      subject:    draft.subject,
      body:       draft.body + (draft.signature ? `\n\n${draft.signature}` : ''),
      resumePath: resume?.path         || null,
      resumeName: resume?.originalName || null
    });

    draft.gmailDraftId   = gmailDraftId;
    draft.resumeAttached = !!resume;
    draft.status         = 'approved';
    await draft.save();

    await GmailLog.create({
      user: req.user.id, action: 'create_draft', status: 'success',
      recruiterEmail: draft.recruiter.email,
      recruiterName:  draft.recruiter.name,
      company:        draft.recruiter.company
    });

    res.json({ success: true, message: 'Gmail draft created', data: { gmailDraftId } });
  } catch (error) {
    await GmailLog.create({ user: req.user.id, action: 'create_draft', status: 'failure', error: error.message });
    next(error);
  }
};

// @desc   Send email via Gmail
// @route  POST /api/gmail/send
exports.sendEmail = async (req, res, next) => {
  try {
    const { draftId } = req.body;

    const settings = await Settings.findOne({ user: req.user.id }).select('+googleAccessToken +googleRefreshToken');
    if (!settings?.gmailConnected) {
      return res.status(400).json({ success: false, message: 'Gmail not connected' });
    }

    const draft = await Draft.findOne({ _id: draftId, user: req.user.id }).populate('recruiter');
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    const resume     = await Resume.findOne({ user: req.user.id, isActive: true });
    const authClient = await getAuthClient(settings, req.user.id);

    const result = await sendWithRetry({ authClient, draft, resume });

    const sentAt = new Date();
    draft.status       = 'sent';
    draft.gmailMessageId = result.messageId;
    draft.sentAt       = sentAt;
    await draft.save();

    await Recruiter.findByIdAndUpdate(draft.recruiter._id, { status: 'sent' });

    const application = await Application.create({
      user:           req.user.id,
      recruiter:      draft.recruiter._id,
      draft:          draft._id,
      recruiterName:  draft.recruiter.name,
      company:        draft.recruiter.company,
      recruiterEmail: draft.recruiter.email,
      subject:        draft.subject,
      body:           draft.body,
      status:         'sent',
      gmailMessageId: result.messageId,
      gmailThreadId:  result.threadId,
      sentAt,
      timeline: [{ event: 'Email Sent', timestamp: sentAt, details: `Sent to ${draft.recruiter.email}` }]
    });

    await GmailLog.create({
      user: req.user.id, action: 'send', status: 'success',
      recruiterEmail: draft.recruiter.email,
      recruiterName:  draft.recruiter.name,
      company:        draft.recruiter.company,
      gmailMessageId: result.messageId
    });

    logger.info(`Email sent to ${draft.recruiter.email} by user ${req.user.id}`);

    res.json({
      success: true,
      message: `Email sent successfully to ${draft.recruiter.email}`,
      data: { application, gmailMessageId: result.messageId }
    });
  } catch (error) {
    // ── Mark draft failed ──────────────────────────────────
    const failedDraft = await Draft.findByIdAndUpdate(
      req.body.draftId,
      { status: 'failed', lastError: error.message, $inc: { retryCount: 1 } },
      { new: true }
    ).populate('recruiter');

    // ── Store in FailedEmail so user can retry from Failed Emails page ──
    if (failedDraft?.recruiter) {
      await recordFailedSend({ userId: req.user.id, draft: failedDraft, errorMessage: error.message });
    }

    await GmailLog.create({ user: req.user.id, action: 'send', status: 'failure', error: error.message });
    next(error);
  }
};

// @desc   Bulk send multiple drafts at once
// @route  POST /api/gmail/send-bulk
exports.sendBulk = async (req, res, next) => {
  try {
    const { draftIds } = req.body;
    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return res.status(400).json({ success: false, message: 'draftIds array is required' });
    }

    const settings = await Settings.findOne({ user: req.user.id }).select('+googleAccessToken +googleRefreshToken');
    if (!settings?.gmailConnected) {
      return res.status(400).json({ success: false, message: 'Gmail not connected. Please connect Gmail first.' });
    }

    const resume     = await Resume.findOne({ user: req.user.id, isActive: true });
    const authClient = await getAuthClient(settings, req.user.id);

    const results = [];

    for (const draftId of draftIds) {
      try {
        const draft = await Draft.findOne({ _id: draftId, user: req.user.id }).populate('recruiter');
        if (!draft) {
          results.push({ draftId, success: false, reason: 'Draft not found' });
          continue;
        }
        if (draft.status === 'sent') {
          results.push({ draftId, success: false, reason: 'Already sent', email: draft.recruiter?.email });
          continue;
        }

        const result = await sendWithRetry({ authClient, draft, resume });

        const sentAt = new Date();
        draft.status         = 'sent';
        draft.gmailMessageId = result.messageId;
        draft.sentAt         = sentAt;
        await draft.save();

        await Recruiter.findByIdAndUpdate(draft.recruiter._id, { status: 'sent' });

        await Application.create({
          user:           req.user.id,
          recruiter:      draft.recruiter._id,
          draft:          draft._id,
          recruiterName:  draft.recruiter.name,
          company:        draft.recruiter.company,
          recruiterEmail: draft.recruiter.email,
          subject:        draft.subject,
          body:           draft.body,
          status:         'sent',
          gmailMessageId: result.messageId,
          gmailThreadId:  result.threadId,
          sentAt,
          timeline: [{ event: 'Email Sent', timestamp: sentAt, details: `Sent to ${draft.recruiter.email}` }]
        });

        await GmailLog.create({
          user: req.user.id, action: 'send', status: 'success',
          recruiterEmail: draft.recruiter.email,
          recruiterName:  draft.recruiter.name,
          company:        draft.recruiter.company,
          gmailMessageId: result.messageId
        });

        results.push({
          draftId,
          success:       true,
          email:         draft.recruiter.email,
          recruiterName: draft.recruiter.name,
          company:       draft.recruiter.company,
          gmailMessageId: result.messageId
        });

        logger.info(`Bulk send: email sent to ${draft.recruiter.email}`);
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        // ── Mark draft failed ────────────────────────────────
        const failedDraft = await Draft.findByIdAndUpdate(
          draftId,
          { status: 'failed', lastError: err.message, $inc: { retryCount: 1 } },
          { new: true }
        ).populate('recruiter');

        // ── Store in FailedEmail ─────────────────────────────
        if (failedDraft?.recruiter) {
          await recordFailedSend({ userId: req.user.id, draft: failedDraft, errorMessage: err.message });
        }

        await GmailLog.create({ user: req.user.id, action: 'send', status: 'failure', error: err.message });

        const { reason } = classifyError(err.message);
        results.push({ draftId, success: false, reason });
        logger.error(`Bulk send failed for ${draftId}: ${err.message}`);
      }
    }

    const sent   = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Bulk send complete: ${sent} sent, ${failed} failed`,
      data: { sent, failed, results }
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Retry a single failed draft
// @route  POST /api/gmail/retry
exports.retryFailed = async (req, res, next) => {
  try {
    const { draftId } = req.body;
    const draft = await Draft.findOne({ _id: draftId, user: req.user.id, status: 'failed' });
    if (!draft) return res.status(404).json({ success: false, message: 'Failed draft not found' });

    draft.status    = 'draft';
    draft.lastError = null;
    await draft.save();

    req.body.draftId = draftId;
    return exports.sendEmail(req, res, next);
  } catch (error) { next(error); }
};

// @desc   Resend email for a FailedEmail record (by draftId stored on the record)
// @route  POST /api/gmail/resend-failed
exports.resendFailed = async (req, res, next) => {
  try {
    const { failedEmailId } = req.body;
    if (!failedEmailId) {
      return res.status(400).json({ success: false, message: 'failedEmailId is required' });
    }

    const record = await FailedEmail.findOne({ _id: failedEmailId, user: req.user.id });
    if (!record) return res.status(404).json({ success: false, message: 'Failed email record not found' });

    if (!record.draftId) {
      return res.status(400).json({ success: false, message: 'No draft linked to this failed email record' });
    }

    // Reset the draft status so sendEmail will process it
    await Draft.findByIdAndUpdate(record.draftId, { status: 'draft', lastError: null });

    // Delegate to sendEmail
    req.body.draftId = record.draftId.toString();
    return exports.sendEmail(req, res, next);
  } catch (error) { next(error); }
};
