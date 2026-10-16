/**
 * AI Email Generation Service
 * Supports: OpenAI, Groq, Gemini
 * Set AI_PROVIDER in .env: "openai" | "groq" | "gemini"
 */
const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');

/**
 * Build the system + user prompts
 */
function buildPrompts(promptVars, customTemplate) {
  const {
    recruiterName, company, role, candidateName,
    skills, experience, projects, resumeSummary,
    linkedin, github, portfolio, phone
  } = promptVars;

  // Build a clean signature block from actual profile fields
  const signatureParts = [`Best regards,\n${candidateName}`];
  if (phone) signatureParts.push(phone);
  if (linkedin) signatureParts.push(linkedin);
  if (github) signatureParts.push(github);
  if (portfolio) signatureParts.push(portfolio);
  const signatureBlock = signatureParts.join('\n');

  const systemPrompt = `You are an expert professional email writer. You write concise, natural, and personalized job application emails that sound human and authentic.

Rules:
- Keep the email body under 160 words (excluding the signature)
- Sound professional but natural — not robotic or template-like
- Mention the company name naturally in context
- Highlight skills relevant to the company/role
- Never start with "I am writing to..."
- Each email must be unique even for similar recipients
- End with a clear call to action
- Do NOT invent or add any name, phone number, or links not provided below
- Append EXACTLY the signature provided — do not alter it

CRITICAL JSON FORMAT RULES:
- "subject" must be a SHORT email subject line only (e.g. "Application for Software Developer at TechCorp") — NOT the email body
- "body" must be the FULL email text including greeting, paragraphs, and signature
- subject should be under 100 characters
- body should be 100-300 characters minimum
You MUST respond with valid JSON only. No markdown, no extra text.
Format: {"subject": "short subject line here", "body": "full email body here including signature"}`;

  let userPrompt;
  if (customTemplate && customTemplate.trim()) {
    userPrompt = customTemplate
      .replace(/\{recruiterName\}/g, recruiterName)
      .replace(/\{company\}/g, company)
      .replace(/\{role\}/g, role)
      .replace(/\{candidateName\}/g, candidateName)
      .replace(/\{skills\}/g, skills)
      .replace(/\{experience\}/g, experience)
      .replace(/\{projects\}/g, projects)
      .replace(/\{resumeSummary\}/g, resumeSummary || '')
      .replace(/\{phone\}/g, phone || '')
      .replace(/\{linkedin\}/g, linkedin || '')
      .replace(/\{github\}/g, github || '')
      .replace(/\{portfolio\}/g, portfolio || '');
  } else {
    userPrompt = `Write a job application email for this candidate applying to ${company}.

RECRUITER: ${recruiterName} at ${company}
ROLE: ${role || 'Software Developer'}

CANDIDATE RESUME:
${resumeSummary || 'No resume provided'}

CONTACT DETAILS TO USE IN SIGNATURE (use exactly as given):
${signatureBlock}

INSTRUCTIONS:
- Write a professional, human-sounding email based on the candidate's ACTUAL resume content above
- Pick the most relevant skills, projects, and experience from the resume for this specific company/role
- Keep the email body under 120 words before the signature
- Do not start with "I am writing to..."
- End with a call to action to schedule a call/meeting
- Append the signature exactly as provided above

Return ONLY this JSON (no extra text, no markdown):
{
  "subject": "Application for ${role || 'Software Developer'} Role at ${company}",
  "body": "Dear ${recruiterName},\\n\\n[your email paragraphs here]\\n\\n${signatureBlock.replace(/\n/g, '\\\\n')}"
}

Replace the placeholder values with the actual generated content.`;
  }

  return { systemPrompt, userPrompt };
}

/**
 * Generate email via OpenAI
 */
const generateWithOpenAI = async (apiKey, promptVars, customTemplate) => {
  const client = new OpenAI({ apiKey });
  const { systemPrompt, userPrompt } = buildPrompts(promptVars, customTemplate);

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.85,
    max_tokens: 800,
    response_format: { type: 'json_object' }
  });

  logger.info(`OpenAI (${model}) generated email for ${promptVars.recruiterName} at ${promptVars.company}`);
  return response.choices[0].message.content;
};

/**
 * Generate email via Groq
 * Groq uses the same OpenAI SDK interface with a different baseURL
 */
const generateWithGroq = async (apiKey, promptVars, customTemplate) => {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1'
  });
  const { systemPrompt, userPrompt } = buildPrompts(promptVars, customTemplate);

  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.85,
    max_tokens: 800
  });

  logger.info(`Groq (${model}) generated email for ${promptVars.recruiterName} at ${promptVars.company}`);
  return response.choices[0].message.content;
};

/**
 * Generate email via Gemini (free tier — 1500 req/day, no card needed)
 */
const generateWithGemini = async (apiKey, promptVars, customTemplate) => {
  const client = new GoogleGenAI({ apiKey });
  const { systemPrompt, userPrompt } = buildPrompts(promptVars, customTemplate);
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  const response = await client.models.generateContent({
    model,
    contents: `${systemPrompt}\n\n${userPrompt}`,
    config: {
      temperature: 0.85,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  });

  // Extract text safely — SDK may return string directly or nested in candidates
  const raw = typeof response.text === 'string'
    ? response.text
    : response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  logger.info(`Gemini (${model}) generated email for ${promptVars.recruiterName} at ${promptVars.company}`);
  logger.debug(`Gemini raw response: ${raw.slice(0, 300)}`);
  return raw;
};

/**
 * Main export — auto-selects provider based on AI_PROVIDER env var
 */
const generateEmail = async (apiKey, promptVars, customTemplate = '') => {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  let content;
  if (provider === 'gemini') {
    content = await generateWithGemini(apiKey, promptVars, customTemplate);
  } else if (provider === 'groq') {
    content = await generateWithGroq(apiKey, promptVars, customTemplate);
  } else {
    content = await generateWithOpenAI(apiKey, promptVars, customTemplate);
  }

  return parseEmailResponse(content, promptVars.company, promptVars.candidateName);
};

/**
 * Parse AI JSON response into subject + body.
 * Falls back to text parsing if the model doesn't return valid JSON.
 */
function parseEmailResponse(content, company, candidateName) {
  logger.debug(`Raw AI response: ${content}`);

  // Primary: try JSON parse (structured output)
  try {
    // 1. Strip markdown fences
    let cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    // 2. Fix unescaped real newlines inside JSON string values
    //    Replace literal newline chars inside quoted strings with \n
    cleaned = cleaned.replace(
      /"((?:[^"\\]|\\.)*)"/gs,
      (match) => match.replace(/\n/g, '\\n').replace(/\r/g, '')
    );

    // 3. If JSON is truncated (no closing brace), try to repair it
    if (!cleaned.endsWith('}')) {
      // Close any open string and the object
      const lastQuote = cleaned.lastIndexOf('"');
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastQuote > lastBrace) {
        // String is open — close it and close the object
        cleaned = cleaned + '"}'
      } else {
        cleaned = cleaned + '}';
      }
    }

    const parsed = JSON.parse(cleaned);

    if (parsed.subject && parsed.body) {
      let subject = parsed.subject.trim();
      let body    = parsed.body.trim();

      // Auto-fix swapped fields
      if (subject.length > 150 || body.length < 80) {
        logger.warn('Subject/body appear swapped — auto-correcting');
        [subject, body] = [body, subject];
      }

      // If subject still contains newlines or is very long, extract first clean line
      if (subject.includes('\n') || subject.length > 120) {
        const lines = subject.split('\n').map(l => l.trim()).filter(Boolean);
        const subjectLine = lines.find(l => l.length < 120 && !l.toLowerCase().startsWith('dear'));
        if (subjectLine) { body = subject; subject = subjectLine; }
      }

      // Replace literal \n sequences with real newlines in body
      body = body.replace(/\\n/g, '\n');

      return { subject, body, rawContent: content };
    }
  } catch (e) {
    logger.warn(`JSON parse failed: ${e.message} — falling back to text parsing`);
  }

  // Fallback: Subject:/Body: markers
  let subject = '';
  let body    = '';

  const subjectMatch = content.match(/^Subject:\s*(.+)$/im);
  if (subjectMatch) subject = subjectMatch[1].trim();

  const bodyLabelMatch = content.match(/^Body:\s*([\s\S]+)$/im);
  if (bodyLabelMatch) {
    body = bodyLabelMatch[1].trim();
  } else if (subject) {
    body = content.replace(/^Subject:.*$/im, '').trim();
  } else {
    const lines = content.trim().split('\n');
    subject = lines[0].trim();
    body    = lines.slice(1).join('\n').trim();
  }

  if (!subject) subject = `Application for Software Developer Role at ${company}`;
  if (!body)    body    = content;

  body = body.replace(/\\n/g, '\n');
  return { subject, body, rawContent: content };
}

module.exports = { generateEmail };
