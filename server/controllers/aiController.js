/**
 * AI Email Generation Controller
 *
 * Generates a separate AI draft for each recruiter using the active resume,
 * job description, recruiter context, and candidate profile links.
 */
const Draft         = require('../models/Draft');
const Recruiter     = require('../models/Recruiter');
const Resume        = require('../models/Resume');
const { getResumePath } = require('../utils/uploadPaths');
const Settings      = require('../models/Settings');
const EmailTemplate = require('../models/EmailTemplate');
const logger        = require('../utils/logger');
const { removeTrailingSignature } = require('../utils/emailContent');
const { generatePerRecruiterEmail, resolveApiKey, extractResumeText } = require('./emailTemplateController');

function getPrimaryRole(role) {
  const roles = String(role || '')
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);
  const title = roles.find((item) => /\b(developer|engineer|designer|analyst|manager|scientist|architect|consultant|intern)\b/i.test(item));
  return title || roles.find((item) => !/^(fresher|entry[- ]level|junior|senior)$/i.test(item)) || 'Software Developer';
}

/**
 * Fetch the latest active master template, including templates saved before
 * role categories were removed.
 */
async function getMasterTemplate(userId) {
  return EmailTemplate.findOne({
    user: userId,
    isActive: true
  }).sort({ createdAt: -1 });
}

/**
 * Build the subject + body for one recruiter using the matched EmailTemplate & AI.
 *
 * Returns { subject, body, signature, usedAI: true }
 */
async function buildDraftForRecruiter(recruiter, settings, resumeContext) {
  const baseTemplate = await getMasterTemplate(recruiter.user || settings.user);
  const role = getPrimaryRole(recruiter.role);
  const recruiterForEmail = { ...recruiter.toObject(), role };

  const generated = await generatePerRecruiterEmail(
    resumeContext.apiKey,
    resumeContext.provider,
    resumeContext.text,
    recruiterForEmail,
    settings,
    baseTemplate
  );

  const company = (recruiter.company || '').trim();
  const hrName = (recruiter.name || '').trim();
  const emailPrefix = (recruiter.email || '').split('@')[0].toLowerCase();
  const greeting = (!hrName || hrName.toLowerCase() === emailPrefix || /not publicly found|hiring team|unknown|n\/a/i.test(hrName))
    ? 'Dear Hiring Team,'
    : `Dear ${hrName},`;

  const candidateName = (settings.candidateName || 'Candidate').trim();
  const subject = `Application for ${role} - ${candidateName}`.slice(0, 100);

  let body = (generated.body || '')
    .replace(/\{\{greeting\}\}/gi, greeting)
    .replace(/\{\{role\}\}/gi, role)
    .replace(/\{\{company\}\}/gi, company)
    .replace(/\{\{signature\}\}/gi, '');

  body = removeTrailingSignature(body, generated.signature);
  const jobPosting = `${recruiter.jobDescription || ''}\n${recruiter.notes || ''}`
    .match(/https?:\/\/[^\s<>"']+/i)?.[0]?.replace(/[),.;]+$/g, '');
  if (jobPosting && !body.includes(jobPosting)) {
    body = `${body}\n\nJob Posting: ${jobPosting}`;
  }

  logger.info(`AI draft for ${recruiter.email} | role: "${role}" | masterTemplate: ${baseTemplate ? 'yes' : 'no'} | provider: ${resumeContext.provider}`);
  return { subject, body, signature: generated.signature, usedAI: true };
}

/**
 * Gather resume text + API key once, then reuse for all recruiters in a batch.
 * Returns { text, apiKey, provider } — text is null if unavailable.
 */
async function loadResumeContext(userId, settings) {
  const resume = await Resume.findOne({ user: userId, isActive: true });
  if (!resume) {
    const error = new Error('Upload an active resume before generating personalized emails.');
    error.statusCode = 400;
    throw error;
  }

  const { text, warning } = await extractResumeText(getResumePath(resume), resume.mimetype);
  if (!text) {
    const error = new Error(warning || 'Could not extract text from your resume. Upload a text-based PDF or DOCX.');
    error.statusCode = 400;
    throw error;
  }

  const { apiKey, provider } = resolveApiKey(settings);
  if (!apiKey) {
    const providerKey = { gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY' }[provider] || 'OPENAI_API_KEY or the AI key in Settings';
    const error = new Error(`AI provider key is not configured. Set ${providerKey} before generating emails.`);
    error.statusCode = 400;
    throw error;
  }

  return { text, apiKey, provider };
}

// @desc   Create a draft for one recruiter (role-specific, AI-powered)
// @route  POST /api/ai/generate
exports.generateEmail = async (req, res, next) => {
  try {
    const { recruiterId } = req.body;

    const [settings, recruiter] = await Promise.all([
      Settings.findOne({ user: req.user.id }),
      Recruiter.findOne({ _id: recruiterId, user: req.user.id }),
    ]);

    if (!settings) {
      return res.status(400).json({ success: false, message: 'Please complete your profile in Settings first' });
    }
    if (!recruiter) {
      return res.status(404).json({ success: false, message: 'Recruiter not found' });
    }

    const resumeContext = await loadResumeContext(req.user.id, settings);
    const { subject, body, signature, usedAI } = await buildDraftForRecruiter(recruiter, settings, resumeContext);

    const draft = await Draft.create({
      user      : req.user.id,
      recruiter : recruiter._id,
      subject,
      body,
      signature,
      status    : 'draft',
    });

    await Recruiter.findByIdAndUpdate(recruiter._id, { status: 'drafted' });

    logger.info(`Draft created for ${recruiter.name} @ ${recruiter.company} | role: "${recruiter.role}" | AI: ${usedAI}`);

    res.json({
      success: true,
      message: `AI email draft generated for the ${recruiter.role || 'job'} role`,
      data: { draft, generated: { subject, body } },
    });
  } catch (error) {
    logger.error(`AI generate error: ${error.message}`);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Generate for all new recruiters
// ─────────────────────────────────────────────────────────────────────────────

// @desc   Create drafts for every recruiter with status 'new'
// @route  POST /api/ai/generate-for-new
exports.generateForNew = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ user: req.user.id });
    if (!settings) {
      return res.status(400).json({ success: false, message: 'Please complete your profile in Settings' });
    }

    const newRecruiters = await Recruiter.find({ user: req.user.id, status: 'new' });
    if (newRecruiters.length === 0) {
      return res.json({
        success: true,
        message: 'No new recruiters to process — all are already drafted or sent.',
        data: { created: 0, total: 0 },
      });
    }

    // Load resume context once for the whole batch (single AI key + resume read)
    const resumeContext = await loadResumeContext(req.user.id, settings);

    let created  = 0;
    let aiCount  = 0;
    const errors = [];
    for (const recruiter of newRecruiters) {
      try {
        const { subject, body, signature, usedAI } = await buildDraftForRecruiter(recruiter, settings, resumeContext);
        await Draft.create({
          user      : req.user.id,
          recruiter : recruiter._id,
          subject,
          body,
          signature,
          status    : 'draft',
        });
        await Recruiter.findByIdAndUpdate(recruiter._id, { status: 'drafted' });
        created++;
        if (usedAI) aiCount++;
        logger.info(`generateForNew: draft for ${recruiter.email} | role: ${recruiter.role || 'unspecified'} | AI: ${usedAI}`);
      } catch (err) {
        logger.error(`generateForNew: failed for ${recruiter.email} — ${err.message}`);
        errors.push(recruiter.email);
      }
    }

    logger.info(`generateForNew: ${created}/${newRecruiters.length} drafts created (${aiCount} AI-generated) for user ${req.user.id}`);

    res.json({
      success: true,
      message: `${created} draft${created !== 1 ? 's' : ''} created${aiCount > 0 ? ` (${aiCount} AI-customized for their role)` : ' with role-specific emails'}.`,
      data: { created, total: newRecruiters.length, aiCount, errors },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Batch generate
// ─────────────────────────────────────────────────────────────────────────────

// @desc   Create drafts for multiple recruiters
// @route  POST /api/ai/generate-batch
exports.generateBatch = async (req, res, next) => {
  try {
    const { recruiterIds } = req.body;
    if (!recruiterIds || !Array.isArray(recruiterIds) || recruiterIds.length === 0) {
      return res.status(400).json({ success: false, message: 'recruiterIds array is required' });
    }

    const settings = await Settings.findOne({ user: req.user.id });
    if (!settings) {
      return res.status(400).json({ success: false, message: 'Please complete your profile in Settings' });
    }

    // Load resume context once for the whole batch
    const resumeContext = await loadResumeContext(req.user.id, settings);

    const results = [];
    for (let i = 0; i < recruiterIds.length; i++) {
      const recruiterId = recruiterIds[i];
      try {
        const recruiter = await Recruiter.findOne({ _id: recruiterId, user: req.user.id });
        if (!recruiter) {
          results.push({ recruiterId, success: false, reason: 'Recruiter not found' });
          continue;
        }

        const { subject, body, signature, usedAI } = await buildDraftForRecruiter(recruiter, settings, resumeContext);
        const draft = await Draft.create({
          user      : req.user.id,
          recruiter : recruiter._id,
          subject,
          body,
          signature,
          status    : 'draft',
        });

        await Recruiter.findByIdAndUpdate(recruiter._id, { status: 'drafted' });
        results.push({ recruiterId, success: true, draftId: draft._id, usedAI });

        logger.info(`Batch [${i + 1}/${recruiterIds.length}]: draft for ${recruiter.name} @ ${recruiter.company} | role: ${recruiter.role || 'unspecified'} | AI: ${usedAI}`);
      } catch (err) {
        logger.error(`Batch [${i + 1}/${recruiterIds.length}]: failed for ${recruiterId} — ${err.message}`);
        results.push({ recruiterId, success: false, reason: err.message });
      }
    }

    const sent    = results.filter(r => r.success).length;
    const failed  = results.filter(r => !r.success).length;
    const aiCount = results.filter(r => r.usedAI).length;
    logger.info(`Batch complete: ${sent} drafts created (${aiCount} AI-generated), ${failed} failed`);

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};
