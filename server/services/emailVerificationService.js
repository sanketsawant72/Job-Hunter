/**
 * Abstract Email Verification Service
 * Docs: https://app.abstractapi.com/api/email-validation
 *
 * Free tier: 100 requests/month
 * API key set via ABSTRACT_API_KEY in .env
 */
const https = require('https');
const logger = require('../utils/logger');

// Abstract API base URL
const BASE_URL = 'https://emailvalidation.abstractapi.com/v1/';

/**
 * Verify a single email address via Abstract API.
 * Returns a normalised result object regardless of API response shape.
 *
 * @param {string} email
 * @returns {{ deliverability: string, isValidFormat: boolean, isMxFound: boolean, raw: object }}
 */
const verifyEmail = (email) => {
  return new Promise((resolve) => {
    const apiKey = process.env.ABSTRACT_API_KEY;

    if (!apiKey) {
      // No API key configured → skip verification, mark as SKIPPED
      logger.warn('ABSTRACT_API_KEY not set – email verification skipped');
      return resolve({ deliverability: 'SKIPPED', isValidFormat: true, isMxFound: null, raw: null });
    }

    const url = `${BASE_URL}?api_key=${apiKey}&email=${encodeURIComponent(email)}`;

    const req = https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);

          // Handle API-level errors (bad key, quota exceeded, etc.)
          if (data.error) {
            logger.warn(`Abstract API error for ${email}: ${JSON.stringify(data.error)}`);
            return resolve({ deliverability: 'UNKNOWN', isValidFormat: true, isMxFound: null, raw: data });
          }

          const deliverability = (data.deliverability || 'UNKNOWN').toUpperCase();
          resolve({
            deliverability,                           // DELIVERABLE | UNDELIVERABLE | RISKY | UNKNOWN
            isValidFormat: data.is_valid_format?.value ?? true,
            isMxFound:     data.is_mx_found?.value    ?? null,
            isSMTPValid:   data.is_smtp_valid?.value  ?? null,
            isDisposable:  data.is_disposable_email?.value ?? false,
            isFreeEmail:   data.is_free_email?.value  ?? null,
            raw: data
          });
        } catch (parseErr) {
          logger.error(`Abstract API parse error for ${email}: ${parseErr.message}`);
          resolve({ deliverability: 'UNKNOWN', isValidFormat: true, isMxFound: null, raw: null });
        }
      });
    });

    req.on('error', (err) => {
      // Network error → treat as UNKNOWN so recruiter is still saved
      logger.error(`Abstract API network error for ${email}: ${err.message}`);
      resolve({ deliverability: 'UNKNOWN', isValidFormat: true, isMxFound: null, raw: null });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      logger.warn(`Abstract API timeout for ${email}`);
      resolve({ deliverability: 'UNKNOWN', isValidFormat: true, isMxFound: null, raw: null });
    });
  });
};

/**
 * Verify a batch of emails with rate-limit protection.
 * Abstract free tier: ~1 req/sec is safe.
 * Processes in chunks of `batchSize` with `delayMs` between chunks.
 *
 * @param {string[]} emails
 * @param {{ batchSize?: number, delayMs?: number }} options
 * @returns {Map<string, object>}  email → verification result
 */
const verifyBatch = async (emails, { batchSize = 5, delayMs = 1200 } = {}) => {
  const results = new Map();

  for (let i = 0; i < emails.length; i += batchSize) {
    const chunk = emails.slice(i, i + batchSize);

    await Promise.all(
      chunk.map(async (email) => {
        const result = await verifyEmail(email);
        results.set(email, result);
      })
    );

    // Delay between chunks to stay under rate limit
    if (i + batchSize < emails.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
};

/**
 * Map Abstract deliverability → internal verificationStatus
 */
const toVerificationStatus = (deliverability) => {
  const map = {
    DELIVERABLE:   'DELIVERABLE',
    UNDELIVERABLE: 'UNDELIVERABLE',
    RISKY:         'RISKY',
    UNKNOWN:       'UNKNOWN',
    SKIPPED:       'SKIPPED'
  };
  return map[deliverability] || 'UNKNOWN';
};

/**
 * Determine whether a recruiter should be saved to the main collection
 * based on verification result.
 *
 * DELIVERABLE  → save normally,  isValid = true
 * RISKY        → save,           isValid = true,  status = RISKY (user decides)
 * UNKNOWN      → save,           isValid = true,  status = UNKNOWN
 * SKIPPED      → save,           isValid = true
 * UNDELIVERABLE → do NOT save to Recruiters; create FailedEmail record instead
 */
const shouldSaveRecruiter = (deliverability) => {
  return deliverability !== 'UNDELIVERABLE';
};

module.exports = { verifyEmail, verifyBatch, toVerificationStatus, shouldSaveRecruiter };
