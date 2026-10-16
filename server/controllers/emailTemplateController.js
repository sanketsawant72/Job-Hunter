/**
 * Email Template Controller
 *
 * Generates ONE master job-application email EXCLUSIVELY from the
 * uploaded resume file. Profile fields (skills, experience, projects,
 * resumeSummary) are deliberately IGNORED — the only source of truth
 * for email content is the parsed resume text.
 *
 * Credit-optimisation contract:
 *   • 1 resume → 1 AI call → 1 stored template → reused for ALL companies
 *   • AI is called ONLY when:
 *       a) No template exists yet
 *       b) The active resume file hash differs from the stored template hash
 *       c) The user explicitly sends force=true ("Regenerate Email")
 *   • Manual edits (PUT /api/email-template/:id) NEVER call the AI
 */

const crypto        = require('crypto');
const fs            = require('fs');
const OpenAI        = require('openai');
const EmailTemplate = require('../models/EmailTemplate');
const Resume        = require('../models/Resume');
const Settings      = require('../models/Settings');
const logger        = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

/** SHA-256 hash of a file — used to detect resume changes without re-parsing. */
function hashFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Extract plain text from the resume file.
 * PDF   → use pdf-parse (up to 5000 chars)
 * DOCX  → use mammoth if available, otherwise return null so we can
 *          tell the user their file couldn't be read.
 * Returns { text, warning } where warning is set if extraction was partial.
 */
async function extractResumeText(resumePath, mimetype) {
  if (!resumePath || !fs.existsSync(resumePath)) {
    return { text: null, warning: 'Resume file not found on disk.' };
  }

  try {
    if (mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const buffer   = fs.readFileSync(resumePath);
      const data     = await pdfParse(buffer);
      const text     = data.text.replace(/\s+/g, ' ').trim();
      if (!text || text.length < 50) {
        return { text: null, warning: 'PDF appears to be image-based or empty — no text could be extracted.' };
      }
      // Allow up to 5000 chars so the AI has enough context
      return { text: text.slice(0, 5000), warning: null };
    }

    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      try {
        const mammoth = require('mammoth');
        const result  = await mammoth.extractRawText({ path: resumePath });
        const text    = result.value.replace(/\s+/g, ' ').trim();
        if (!text || text.length < 50) {
          return { text: null, warning: 'DOCX file appears empty — no text could be extracted.' };
        }
        return { text: text.slice(0, 5000), warning: null };
      } catch {
        return { text: null, warning: 'DOCX parsing failed. Install mammoth: npm i mammoth' };
      }
    }

    return { text: null, warning: `Unsupported resume format: ${mimetype}` };
  } catch (err) {
    logger.warn(`Resume text extraction failed: ${err.message}`);
    return { text: null, warning: `Could not read resume: ${err.message}` };
  }
}

/**
 * Resolve which AI provider + key to use.
 * AI_PROVIDER in .env always wins — user's openaiApiKey in Settings is
 * only used as an override when the provider is explicitly 'openai'.
 */
function resolveApiKey(settings) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  if (provider === 'gemini') return { apiKey: process.env.GEMINI_API_KEY, provider };
  if (provider === 'groq')   return { apiKey: process.env.GROQ_API_KEY,   provider };

  // provider === 'openai' — user key in Settings takes priority over .env
  const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  return { apiKey, provider };
}

/**
 * Build the signature block from Settings contact fields only —
 * never from email body / profile summary.
 */
function buildSignature(settings) {
  const lines = [`Best regards,\n${settings.candidateName || 'Candidate'}`];
  if (settings.phone)     lines.push(settings.phone);
  if (settings.linkedin)  lines.push(settings.linkedin.replace(/^(https?:)(https?:\/\/)/i, '$2').trim());
  if (settings.github)    lines.push(settings.github.replace(/^(https?:)(https?:\/\/)/i, '$2').trim());
  if (settings.portfolio) lines.push(settings.portfolio.replace(/^(https?:)(https?:\/\/)/i, '$2').trim());
  return lines.join('\n');
}

/**
 * Call the AI with the resume-only prompt.
 * Bypasses openaiService entirely so no profile data can leak in.
 * Returns { subject, body }.
 * Retries up to 4 times on 503 / rate-limit errors with exponential backoff.
 */
async function generateMasterEmail(apiKey, provider, resumeText, signature, attempt = 0) {
  const MAX_RETRIES  = 4;
  const BASE_DELAY_MS = 3000; // 3s, 6s, 12s, 24s
  const systemPrompt = `You are a professional email writer helping a job seeker send applications.
Your ONLY source of information about the candidate is the resume text provided.
Do NOT invent skills, experiences, or details not present in the resume.
Do NOT use any company name or recruiter name in the email — it must be completely generic.
Respond with valid JSON only: {"subject": "...", "body": "..."}`;

  const userPrompt = `Write a professional job-application email based ONLY on the resume below.

RULES:
- Greeting: "Dear Hiring Team,"
- No company name anywhere in the email
- No recruiter name anywhere in the email
- Base ALL content (skills, experience, projects, education) strictly on the resume text below
- Do not add anything that is not in the resume
- Keep the body under 160 words (before the signature)
- End with a call to action
- Append the signature block exactly as given at the end

RESUME:
${resumeText}

SIGNATURE (copy exactly, do not change):
${signature}

Return ONLY this JSON, no markdown, no extra text:
{"subject": "Application for Software Development Opportunity", "body": "Dear Hiring Team,\\n\\n[paragraphs from resume content]\\n\\n${signature.replace(/\n/g, '\\n')}"}`;

  let rawContent;

  if (provider === 'gemini') {
    const { GoogleGenAI, createUserContent, createPartFromText } = require('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    const model  = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    const response = await client.models.generateContent({
      model,
      contents: createUserContent([
        createPartFromText(`${systemPrompt}\n\n${userPrompt}`)
      ]),
      config: {
        temperature:     0.7,
        maxOutputTokens: 2048,   // enough for full email + thinking tokens
      },
    });

    // The model may return multiple parts (text + thoughtSignature).
    // Collect all non-thought text parts and find the JSON one.
    const candidates = response?.candidates || [];
    if (candidates.length > 0) {
      const parts = candidates[0]?.content?.parts || [];
      // Prefer the part that looks like JSON
      const jsonPart = parts
        .filter(p => !p.thought && p.text)
        .find(p => p.text.trim().startsWith('{')) ;
      rawContent = jsonPart?.text
        ?? parts.filter(p => !p.thought && p.text).map(p => p.text).join('')
        ?? response.text
        ?? '';
    } else {
      rawContent = response.text ?? '';
    }

    logger.info(`Gemini (${model}) response parts: ${response?.candidates?.[0]?.content?.parts?.length ?? 0}, text length: ${rawContent.length}`);

    if (!rawContent || rawContent.trim().length < 10) {
      throw new Error(`Gemini returned empty response. Check model name (${model}) and API key.`);
    }

  } else if (provider === 'groq') {
    const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
    const model  = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const res    = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1024
    });
    rawContent = res.choices[0].message.content;

  } else {
    // Default: OpenAI
    const client = new OpenAI({ apiKey });
    const model  = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res    = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: 'json_object' }
    });
    rawContent = res.choices[0].message.content;
  }

  return parseResponse(rawContent);
}

// ── internal retry wrapper ────────────────────────────────────────────────
/**
 * Wraps generateMasterEmail with exponential backoff on 503 / rate-limit errors.
 * Gemini 503 = high demand (temporary). Retries up to MAX_RETRIES times.
 */
async function generateMasterEmailWithRetry(apiKey, provider, resumeText, signature) {
  const MAX_RETRIES   = 4;
  const BASE_DELAY_MS = 3000; // 3s → 6s → 12s → 24s

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateMasterEmail(apiKey, provider, resumeText, signature);
    } catch (err) {
      const is503     = err?.status === 503
        || err?.code  === 503
        || err?.error?.code === 503
        || err?.message?.toLowerCase().includes('503')
        || err?.message?.toLowerCase().includes('unavailable')
        || err?.message?.toLowerCase().includes('high demand')
        || err?.message?.toLowerCase().includes('overloaded');

      const isRateLimit = err?.status === 429
        || err?.code  === 429
        || err?.message?.toLowerCase().includes('rate_limit')
        || err?.message?.toLowerCase().includes('too_many_requests');

      if ((is503 || isRateLimit) && attempt < MAX_RETRIES) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(`AI provider ${provider} returned ${is503 ? '503' : '429'} — retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      throw err; // non-retryable or exhausted retries
    }
  }
}

/** Parse AI JSON response → { subject, body }. */
function parseResponse(raw) {
  try {
    let cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    // Fix unescaped newlines inside string values
    cleaned = cleaned.replace(/"((?:[^"\\]|\\.)*)"/gs, m => m.replace(/\n/g, '\\n').replace(/\r/g, ''));

    // Repair truncated JSON
    if (!cleaned.endsWith('}')) {
      cleaned += cleaned.lastIndexOf('"') > cleaned.lastIndexOf('}') ? '"}' : '}';
    }

    const parsed = JSON.parse(cleaned);
    if (parsed.subject && parsed.body) {
      let { subject, body } = parsed;
      // Swap if fields look reversed
      if (subject.length > 150 || body.length < 50) [subject, body] = [body, subject];
      body = body.replace(/\\n/g, '\n');
      return { subject: subject.trim(), body: body.trim() };
    }
  } catch (e) {
    logger.warn(`Master template JSON parse failed: ${e.message}`);
  }

  // Fallback: treat first line as subject, rest as body
  const lines   = raw.trim().split('\n');
  const subject = lines[0].replace(/^Subject:\s*/i, '').trim() || 'Application for Software Development Opportunity';
  const body    = lines.slice(1).join('\n').replace(/^Body:\s*/i, '').trim() || raw;
  return { subject, body: body.replace(/\\n/g, '\n') };
}

// ─────────────────────────────────────────────────────────────────────────────
// controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/email-template
 * Returns current active template + resume metadata.
 * Never calls AI.
 */
exports.getTemplate = async (req, res, next) => {
  try {
    const [template, resume] = await Promise.all([
      EmailTemplate.findOne({ user: req.user.id, isActive: true }).sort({ createdAt: -1 }),
      Resume.findOne({ user: req.user.id, isActive: true }),
    ]);

    let resumeChanged = false;
    if (template && resume) {
      const currentHash = hashFile(resume.path);
      resumeChanged = currentHash !== null && currentHash !== template.resumeHash;
    }

    res.json({
      success: true,
      data: {
        template: template || null,
        resume  : resume ? { _id: resume._id, originalName: resume.originalName, createdAt: resume.createdAt } : null,
        resumeChanged,
      },
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/email-template/generate
 * Generates the master email from the resume ONLY.
 * Body: { force?: boolean }
 */
exports.generateTemplate = async (req, res, next) => {
  try {
    const force = req.body?.force === true;

    const [settings, resume] = await Promise.all([
      Settings.findOne({ user: req.user.id }),
      Resume.findOne({ user: req.user.id, isActive: true }),
    ]);

    if (!settings) {
      return res.status(400).json({ success: false, message: 'Please complete your profile in Settings first.' });
    }
    if (!resume) {
      return res.status(400).json({ success: false, message: 'Please upload a resume first. The email is generated from your resume.' });
    }

    // ── Hash check ───────────────────────────────────────────
    const currentHash = hashFile(resume.path);
    const existing    = await EmailTemplate.findOne({ user: req.user.id, isActive: true });

    if (existing && !force) {
      const sameHash = existing.resumeHash && currentHash && existing.resumeHash === currentHash;
      if (sameHash) {
        logger.info(`Skipping AI call — resume unchanged for user ${req.user.id}`);
        return res.json({ success: true, generated: false, message: 'Template is already up-to-date.', data: existing });
      }
    }

    // ── Extract resume text ──────────────────────────────────
    const { text: resumeText, warning } = await extractResumeText(resume.path, resume.mimetype);

    if (!resumeText) {
      return res.status(400).json({
        success: false,
        message: warning || 'Could not extract text from your resume. Please upload a text-based PDF or DOCX.',
      });
    }

    logger.info(`Extracted ${resumeText.length} chars from resume for user ${req.user.id}`);

    // ── API key ──────────────────────────────────────────────
    const { apiKey, provider } = resolveApiKey(settings);
    if (!apiKey) {
      const hints = { gemini: 'Add GEMINI_API_KEY to server .env', groq: 'Add GROQ_API_KEY to server .env' };
      return res.status(400).json({
        success: false,
        message: `AI API key not configured. ${hints[provider] || 'Add OPENAI_API_KEY to server .env or enter it in Settings.'}`,
      });
    }

    // ── Build signature from contact info only ───────────────
    const signature = buildSignature(settings);

    // ── Call AI — resume text + signature only ───────────────
    logger.info(`Calling ${provider} for master template (resume-only) — user ${req.user.id}`);
    const generated = await generateMasterEmailWithRetry(apiKey, provider, resumeText, signature);

    // ── Persist ──────────────────────────────────────────────
    await EmailTemplate.updateMany({ user: req.user.id }, { isActive: false });

    const template = await EmailTemplate.create({
      user      : req.user.id,
      resumeId  : resume._id,
      resumeHash: currentHash,
      subject   : generated.subject,
      body      : generated.body,
      version   : (existing?.version ?? 0) + 1,
      isActive  : true,
    });

    logger.info(`Master email template v${template.version} created for user ${req.user.id}`);

    res.json({ success: true, generated: true, message: 'Master email template generated from your resume.', data: template });

  } catch (error) {
    // Unwrap Gemini/Google error objects — they nest the real code inside error.error
    const errCode    = error?.status || error?.code || error?.error?.code;
    const errMessage = error?.message || JSON.stringify(error);

    logger.error(`Email template generation error: ${errMessage}`);

    if (errCode === 503 || errMessage.toLowerCase().includes('unavailable') || errMessage.toLowerCase().includes('high demand')) {
      return res.status(503).json({
        success: false,
        message: 'The AI provider is currently experiencing high demand. Please wait a moment and try again.',
      });
    }
    if (errCode === 429 || errMessage.includes('quota') || errMessage.includes('rate_limit')) {
      return res.status(429).json({
        success: false,
        message: 'AI quota exceeded or rate limited. Please try again in a few minutes.',
      });
    }
    if (errMessage.includes('API key') || errMessage.includes('api key') || errCode === 401 || errCode === 403) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AI API key. Please check your key in Settings.',
      });
    }

    next(error);
  }
};

/**
 * POST /api/email-template/manual
 * Save a completely hand-written template — zero AI involved.
 */
exports.saveManualTemplate = async (req, res, next) => {
  try {
    const { subject, body } = req.body;

    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Both subject and body are required.' });
    }

    const resume   = await Resume.findOne({ user: req.user.id, isActive: true });
    const existing = await EmailTemplate.findOne({ user: req.user.id, isActive: true });

    // Compute hash so the stale-detection still works after a resume upload
    const currentHash = resume ? hashFile(resume.path) : null;

    await EmailTemplate.updateMany({ user: req.user.id }, { isActive: false });

    const template = await EmailTemplate.create({
      user      : req.user.id,
      resumeId  : resume ? resume._id : null,
      resumeHash: currentHash,
      subject   : subject.trim(),
      body      : body.trim(),
      version   : (existing?.version ?? 0) + 1,
      isActive  : true,
    });

    logger.info(`Manual email template v${template.version} saved for user ${req.user.id}`);

    res.json({ success: true, message: 'Template saved.', data: template });
  } catch (error) { next(error); }
};
exports.updateTemplate = async (req, res, next) => {
  try {
    const { subject, body } = req.body;
    if (!subject && !body) {
      return res.status(400).json({ success: false, message: 'subject or body is required' });
    }

    const template = await EmailTemplate.findOne({ _id: req.params.id, user: req.user.id });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    if (subject) template.subject = subject;
    if (body)    template.body    = body;
    await template.save();

    res.json({ success: true, message: 'Template updated', data: template });
  } catch (error) { next(error); }
};
