function normalizeEmailText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/\\n/g, '\n').trim();
}

function removeTrailingSignature(body, signature = '') {
  let content = normalizeEmailText(body);
  const signatureText = normalizeEmailText(signature);

  if (signatureText && content.toLowerCase().endsWith(signatureText.toLowerCase())) {
    content = content.slice(0, -signatureText.length).trimEnd();
  }

  return content
    .replace(/\n+\s*(?:best regards|kind regards|warm regards|regards|sincerely|yours sincerely)\s*,?\s*(?:\n|$)[\s\S]*$/i, '')
    .trim();
}

function composeEmailBody(body, signature = '') {
  const content = removeTrailingSignature(body, signature);
  const signatureText = normalizeEmailText(signature);
  return [content, signatureText].filter(Boolean).join('\n\n');
}

module.exports = { normalizeEmailText, removeTrailingSignature, composeEmailBody };
