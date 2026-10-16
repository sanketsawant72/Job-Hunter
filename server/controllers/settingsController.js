/**
 * Settings Controller
 */
const Settings = require('../models/Settings');

/**
 * Build a clean email signature from profile fields.
 * Ensures URLs are properly formatted and no stale data bleeds in.
 */
function buildSignatureFromProfile(settings) {
  const name = settings.candidateName || '';
  const phone = settings.phone || '';
  const linkedin = normalizeUrl(settings.linkedin || '');
  const github = normalizeUrl(settings.github || '');
  const portfolio = normalizeUrl(settings.portfolio || '');

  const lines = [`Best regards,\n${name}`];
  if (phone) lines.push(phone);
  if (linkedin) lines.push(linkedin);
  if (github) lines.push(github);
  if (portfolio) lines.push(portfolio);

  return lines.join('\n');
}

/** Remove duplicate protocol prefixes like "https:https://" → "https://" */
function normalizeUrl(url) {
  if (!url) return '';
  return url.replace(/^(https?:)(https?:\/\/)/i, '$2').trim();
}

// @desc   Get user settings
// @route  GET /api/settings
exports.getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ user: req.user.id });
    if (!settings) {
      settings = await Settings.create({ user: req.user.id, candidateName: req.user.name });
    }
    // Mask API key - only show last 4 chars
    const data = settings.toObject();
    if (data.openaiApiKey && data.openaiApiKey.length > 8) {
      data.openaiApiKey = '••••••••' + data.openaiApiKey.slice(-4);
      data.openaiApiKeySet = true;
    } else {
      data.openaiApiKeySet = !!data.openaiApiKey;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc   Update settings
// @route  PUT /api/settings
exports.updateSettings = async (req, res, next) => {
  try {
    const allowed = [
      'candidateName', 'college', 'degree', 'phone', 'location',
      'skills', 'experience', 'projects', 'github', 'linkedin',
      'portfolio', 'emailSignature', 'resumeSummary', 'aiPromptTemplate',
      'notifyOnReply', 'notifyOnSend'
    ];

    // If openaiApiKey provided and not masked, update it
    if (req.body.openaiApiKey && !req.body.openaiApiKey.startsWith('••')) {
      allowed.push('openaiApiKey');
    }

    const updateData = {};
    allowed.forEach(key => {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    });

    // Normalize URL fields — strip duplicate protocol prefixes
    ['linkedin', 'github', 'portfolio'].forEach(key => {
      if (updateData[key]) updateData[key] = normalizeUrl(updateData[key]);
    });

    const settings = await Settings.findOneAndUpdate(
      { user: req.user.id },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );

    // Auto-rebuild signature from profile if any profile field changed
    const profileFields = ['candidateName', 'phone', 'linkedin', 'github', 'portfolio'];
    const profileChanged = profileFields.some(f => updateData[f] !== undefined);
    if (profileChanged && !updateData.emailSignature) {
      // Only auto-rebuild if the user didn't explicitly edit the signature this save
      settings.emailSignature = buildSignatureFromProfile(settings);
      await settings.save();
    }

    res.json({ success: true, message: 'Settings updated', data: settings });
  } catch (error) {
    next(error);
  }
};

// @desc   Rebuild email signature from profile fields
// @route  POST /api/settings/fix-signature
exports.fixSignature = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ user: req.user.id });
    if (!settings) return res.status(404).json({ success: false, message: 'Settings not found' });

    settings.emailSignature = buildSignatureFromProfile(settings);
    // Also normalize stored URLs
    settings.linkedin = normalizeUrl(settings.linkedin);
    settings.github = normalizeUrl(settings.github);
    settings.portfolio = normalizeUrl(settings.portfolio);
    await settings.save();

    res.json({ success: true, message: 'Signature rebuilt from profile', data: { emailSignature: settings.emailSignature } });
  } catch (error) {
    next(error);
  }
};

// @desc   Update just the OpenAI API Key
// @route  PUT /api/settings/api-key
exports.updateApiKey = async (req, res, next) => {
  try {
    const { openaiApiKey } = req.body;
    if (!openaiApiKey) return res.status(400).json({ success: false, message: 'API key is required' });

    await Settings.findOneAndUpdate(
      { user: req.user.id },
      { openaiApiKey },
      { upsert: true }
    );
    res.json({ success: true, message: 'OpenAI API key updated' });
  } catch (error) {
    next(error);
  }
};
