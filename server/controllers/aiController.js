/**
 * AI Email Generation Controller
 *
 * Generates role-specific emails based on the recruiter's job title.
 * No AI API calls — emails are built from templates matched to role category.
 * Categories: web | java | ai | python | general
 */
const Draft         = require('../models/Draft');
const Recruiter     = require('../models/Recruiter');
const EmailTemplate = require('../models/EmailTemplate');
const Settings      = require('../models/Settings');
const logger        = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// Role classification — mirrors your Google Apps Script logic
// ─────────────────────────────────────────────────────────────────────────────
function getRoleCategory(role) {
  const r = (role || '').toLowerCase();
  if (/\b(ai|artificial intelligence|machine learning|ml engineer|nlp|data science|generative ai|llm)\b/.test(r)) return 'ai';
  if (/\b(python)\b/.test(r)) return 'python';
  if (/\b(java|spring boot|backend|back.?end)\b/.test(r)) return 'java';
  if (/\b(full.?stack|frontend|front.?end|web developer|react|next\.?js|mern|node\.?js)\b/.test(r)) return 'web';
  return 'general';
}

// ─────────────────────────────────────────────────────────────────────────────
// Build role-specific subject + body
// ─────────────────────────────────────────────────────────────────────────────
function buildRoleEmail(recruiter, settings) {
  const hrName   = (recruiter.name  || '').trim();
  const company  = (recruiter.company || '').trim();
  const role     = (recruiter.role  || 'Software Developer').trim();

  const name      = settings.candidateName || 'Candidate';
  const degree    = settings.degree        || '';
  const college   = settings.college       || '';
  const linkedin  = normalizeUrl(settings.linkedin  || '');
  const github    = normalizeUrl(settings.github    || '');
  const phone     = settings.phone         || '';

  const greeting = (!hrName || /not publicly found|hiring team|unknown|n\/a/i.test(hrName))
    ? 'Dear Hiring Team,'
    : `Dear ${hrName},`;

  const category = getRoleCategory(role);

  let experience;
  if (category === 'java') {
    experience =
      'Through my software development projects and technical ' +
      'learning, I have developed a foundation in programming, ' +
      'object-oriented concepts, databases, and REST API development. ' +
      'I am strengthening my Java and Spring Boot skills and am ' +
      'eager to apply them to real-world engineering challenges ' +
      'while learning from an experienced team.';
  } else if (category === 'web') {
    experience =
      'My hands-on project experience includes developing web ' +
      'applications using JavaScript, React.js, Node.js, Express.js, ' +
      'MongoDB, and related web technologies. My projects involved ' +
      'authentication, CRUD functionality, and database integration. ' +
      'These experiences have strengthened my understanding of ' +
      'application development, debugging, and building user-focused solutions.';
  } else if (category === 'ai') {
    experience =
      'My experience includes Python-based AI/ML projects, including ' +
      'a Resume Screening System that uses natural language processing, ' +
      'TF-IDF, and similarity scoring to analyze resumes and compare ' +
      'candidate skills. My machine learning project work has helped me ' +
      'build a foundation in data processing, model development, and ' +
      'practical problem-solving.';
  } else if (category === 'python') {
    experience =
      'My experience includes Python development, machine learning ' +
      'project work, and AI-based projects. I have worked on a ' +
      'Resume Screening System using NLP, TF-IDF, and similarity ' +
      'scoring. I am eager to apply my programming and analytical ' +
      'skills to practical development tasks and contribute to ' +
      'meaningful projects.';
  } else {
    experience =
      'My technical background includes software development, ' +
      'web technologies, database integration, and Python-based ' +
      'AI/ML projects. Through my academic work and practical projects, ' +
      'I have developed programming, debugging, and problem-solving ' +
      'skills. I am eager to contribute to your team and grow as a ' +
      'software developer.';
  }

  const subject = `Application for ${role} – ${name}`;

  const signatureLines = [`Best regards,\n${name}`];
  if (degree && college) signatureLines.push(`${degree} | ${college}`);
  if (linkedin) signatureLines.push(`LinkedIn: ${linkedin}`);
  if (github)   signatureLines.push(`GitHub: ${github}`);
  if (phone)    signatureLines.push(`Phone: ${phone}`);
  const signature = signatureLines.join('\n');

  const body =
    `${greeting}\n\n` +
    `I hope you are doing well.\n\n` +
    `I am writing to express my interest in the ${role} opportunity at ${company}. ` +
    (degree && college
      ? `I am currently pursuing ${degree} at ${college} and am seeking an opportunity to apply my technical skills in a professional environment.\n\n`
      : `I am a software developer seeking an opportunity to apply my technical skills in a professional environment.\n\n`) +
    `${experience}\n\n` +
    `I am a motivated learner who values clean code, collaboration, continuous improvement, and solving real-world problems. ` +
    `I would welcome the opportunity to contribute to ${company} while further developing my technical and professional skills.\n\n` +
    `Please find my resume attached for your consideration. ` +
    `I would appreciate the opportunity to discuss my suitability for this position and am available for an interview at your convenience.\n\n` +
    `Thank you for your time and consideration. I look forward to hearing from you.\n\n` +
    `${signature}`;

  return { subject, body, signature };
}

function normalizeUrl(url) {
  if (!url) return '';
  return url.replace(/^(https?:)(https?:\/\/)/i, '$2').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback: build signature only (used when falling back to master template)
// ─────────────────────────────────────────────────────────────────────────────
function buildSignature(settings) {
  const name      = settings.candidateName || '';
  const linkedin  = normalizeUrl(settings.linkedin  || '');
  const github    = normalizeUrl(settings.github    || '');
  const portfolio = normalizeUrl(settings.portfolio || '');
  const phone     = settings.phone || '';

  const lines = [`Best regards,\n${name}`];
  if (phone)     lines.push(phone);
  if (linkedin)  lines.push(linkedin);
  if (github)    lines.push(github);
  if (portfolio) lines.push(portfolio);
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Single email
// ─────────────────────────────────────────────────────────────────────────────

// @desc   Create a draft for one recruiter (role-specific email)
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

    const { subject, body, signature } = buildRoleEmail(recruiter, settings);

    const draft = await Draft.create({
      user      : req.user.id,
      recruiter : recruiter._id,
      subject,
      body,
      signature,
      status    : 'draft',
    });

    await Recruiter.findByIdAndUpdate(recruiter._id, { status: 'drafted' });

    const category = getRoleCategory(recruiter.role);
    logger.info(`Draft created for ${recruiter.name} @ ${recruiter.company} | role: "${recruiter.role}" | category: ${category}`);

    res.json({
      success: true,
      message: `Email draft created (${category} template)`,
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

    let created = 0;
    const errors = [];

    for (const recruiter of newRecruiters) {
      try {
        const { subject, body, signature } = buildRoleEmail(recruiter, settings);
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
        logger.info(`generateForNew: draft for ${recruiter.email} | category: ${getRoleCategory(recruiter.role)}`);
      } catch (err) {
        logger.error(`generateForNew: failed for ${recruiter.email} — ${err.message}`);
        errors.push(recruiter.email);
      }
    }

    logger.info(`generateForNew: ${created}/${newRecruiters.length} drafts created for user ${req.user.id}`);

    res.json({
      success: true,
      message: `${created} draft${created !== 1 ? 's' : ''} created with role-specific emails.`,
      data: { created, total: newRecruiters.length, errors },
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

    const results = [];

    for (let i = 0; i < recruiterIds.length; i++) {
      const recruiterId = recruiterIds[i];
      try {
        const recruiter = await Recruiter.findOne({ _id: recruiterId, user: req.user.id });
        if (!recruiter) {
          results.push({ recruiterId, success: false, reason: 'Recruiter not found' });
          continue;
        }

        const { subject, body, signature } = buildRoleEmail(recruiter, settings);
        const draft = await Draft.create({
          user      : req.user.id,
          recruiter : recruiter._id,
          subject,
          body,
          signature,
          status    : 'draft',
        });

        await Recruiter.findByIdAndUpdate(recruiter._id, { status: 'drafted' });
        results.push({ recruiterId, success: true, draftId: draft._id });

        const category = getRoleCategory(recruiter.role);
        logger.info(`Batch [${i + 1}/${recruiterIds.length}]: draft for ${recruiter.name} @ ${recruiter.company} | category: ${category}`);
      } catch (err) {
        logger.error(`Batch [${i + 1}/${recruiterIds.length}]: failed for ${recruiterId} — ${err.message}`);
        results.push({ recruiterId, success: false, reason: err.message });
      }
    }

    const sent   = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    logger.info(`Batch complete: ${sent} drafts created, ${failed} failed`);

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};
