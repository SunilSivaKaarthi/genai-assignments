const { escapeRegExp } = require('../utils/regexUtil');
const { normalize } = require('../utils/normalizeResult');

function maskContent(content, detectorResults) {
  let out = String(content || '');
  const normals = (detectorResults || []).map(normalize);

  for (const res of normals) {
    if (!res || !Array.isArray(res.matches)) continue;
    for (const m of res.matches) {
      const matched = m && (m.match || m.pattern || m.name || null);
      if (!matched) continue;
      try {
        const re = new RegExp(escapeRegExp(matched), 'g');
        const placeholder = `<${(m.name || m.ruleId || res.detector || 'SENSITIVE')}_MASKED>`;
        out = out.replace(re, placeholder);
      } catch (e) {
        // ignore malformed regex from data
      }
    }
  }

  return out;
}

module.exports = { maskContent };
