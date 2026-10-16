/**
 * Gmail Service - Google OAuth2 + Gmail API
 */
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Build OAuth2 client
const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/gmail/callback'
  );
};

// Get Auth URL (redirects user to Google consent screen)
const getAuthUrl = (userId) => {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.drafts',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent',
    state: userId // Pass userId through OAuth flow
  });
};

// Exchange code for tokens
const getTokensFromCode = async (code) => {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

// Build auth client from stored tokens
const buildAuthClient = (accessToken, refreshToken, expiryDate = null) => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token:  accessToken,
    refresh_token: refreshToken,
    expiry_date:   expiryDate ? new Date(expiryDate).getTime() : undefined
  });
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      logger.info('Gmail OAuth2: new refresh token received via auto-refresh');
    }
    logger.info('Gmail OAuth2: access token auto-refreshed');
  });
  return oauth2Client;
};

// Refresh access token using refresh token and persist new tokens to DB
const refreshAndSaveToken = async (userId, refreshToken) => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();

  const Settings = require('../models/Settings');
  const update = {
    googleAccessToken: credentials.access_token,
    googleTokenExpiry: new Date(credentials.expiry_date)
  };
  // Google occasionally rotates the refresh token — save it if provided
  if (credentials.refresh_token) {
    update.googleRefreshToken = credentials.refresh_token;
    logger.info(`Gmail OAuth2: refresh token rotated for user ${userId}`);
  }
  await Settings.findOneAndUpdate({ user: userId }, update);
  logger.info(`Gmail token refreshed and saved for user ${userId}`);
  return credentials.access_token;
};

// Get connected Gmail email address
const getGmailEmail = async (accessToken) => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return data.email;
};

// Encode email to base64url (Gmail API requirement)
const encodeEmail = (to, subject, body, from, attachmentPath = null, attachmentName = null) => {
  const boundary = `boundary_${Date.now()}`;

  let emailContent;

  if (attachmentPath && fs.existsSync(attachmentPath)) {
    const attachmentData = fs.readFileSync(attachmentPath).toString('base64');
    const ext = path.extname(attachmentPath).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf'
      : ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/octet-stream';

    emailContent = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
      '',
      `--${boundary}`,
      `Content-Type: ${mimeType}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachmentName || path.basename(attachmentPath)}"`,
      '',
      attachmentData,
      '',
      `--${boundary}--`
    ].join('\r\n');
  } else {
    emailContent = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      body
    ].join('\r\n');
  }

  return Buffer.from(emailContent).toString('base64url');
};

// Normalize Google API errors into friendlier Error objects
const normalizeGoogleError = (err) => {
  const status = err?.response?.status || err?.code;
  const errors = err?.response?.data?.error?.errors || [];
  const reason = errors[0]?.reason
    || err?.response?.data?.error?.message
    || err?.response?.data?.error
    || err?.message;
  const fullMessage = err?.response?.data?.error?.message || err?.message || '';

  // Log full details so we can debug
  logger.error(`Google API error — status: ${status}, reason: ${reason}, full: ${fullMessage}`);

  if (status === 401 || reason === 'invalid_grant' || fullMessage.includes('invalid_grant')) {
    const e = new Error('invalid_grant');
    e.code = 401;
    return e;
  }
  if (status === 403) {
    const e = new Error(`Insufficient Permission: ${reason || fullMessage}`);
    e.code = 403;
    e.errors = errors;
    return e;
  }
  return err;
};

// Create Gmail draft
const createDraft = async ({ authClient, to, subject, body, resumePath, resumeName }) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Get sender email
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const from = profile.data.emailAddress;

    const raw = encodeEmail(to, subject, body, from, resumePath, resumeName);

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } }
    });

    logger.info(`Gmail draft created: ${response.data.id} -> ${to}`);
    return response.data.id;
  } catch (err) {
    throw normalizeGoogleError(err);
  }
};

// Send email directly
const sendEmail = async ({ authClient, to, subject, body, resumePath, resumeName }) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const profile = await gmail.users.getProfile({ userId: 'me' });
    const from = profile.data.emailAddress;

    const raw = encodeEmail(to, subject, body, from, resumePath, resumeName);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });

    logger.info(`Email sent via Gmail: ${response.data.id} -> ${to}`);
    return { messageId: response.data.id, threadId: response.data.threadId };
  } catch (err) {
    throw normalizeGoogleError(err);
  }
};

// Send existing draft
const sendDraft = async (authClient, draftId) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const response = await gmail.users.drafts.send({
      userId: 'me',
      requestBody: { id: draftId }
    });

    logger.info(`Gmail draft sent: ${draftId}`);
    return { messageId: response.data.id, threadId: response.data.threadId };
  } catch (err) {
    throw normalizeGoogleError(err);
  }
};

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  buildAuthClient,
  refreshAndSaveToken,
  getGmailEmail,
  createDraft,
  sendEmail,
  sendDraft
};
