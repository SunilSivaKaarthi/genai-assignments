const { loadJsonConfig } = require('../utils/configLoader');

function detectPII(text) {
  const config = loadJsonConfig('pii-rules.json');
  const normalizedText = String(text || '');
  const matches = [];

  for (const rule of config.rules || []) {
    const regex = new RegExp(rule.pattern, 'gi');
    const match = regex.exec(normalizedText);
    if (match) {
      matches.push({
        ruleId: rule.id,
        name: rule.name,
        action: rule.action,
        match: match[0]
      });
    }
  }

  return {
    detector: 'PII',
    matched: matches.length > 0,
    action: matches.length > 0 ? 'BLOCK' : 'ALLOW',
    severity: matches.length > 0 ? 'HIGH' : 'LOW',
    matches
  };
}

module.exports = { detectPII };
