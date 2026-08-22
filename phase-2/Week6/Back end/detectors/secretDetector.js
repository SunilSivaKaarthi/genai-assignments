const { loadJsonConfig } = require('../utils/configLoader');
const { escapeRegExp } = require('../utils/regexUtil');

function detectSecrets(text) {
  const config = loadJsonConfig('secret-rules.json');
  const normalizedText = String(text || '');
  const lowerText = normalizedText.toLowerCase();
  const keywordMatches = [];
  const patternMatches = [];

  for (const keyword of config.keywords || []) {
    const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i');
    if (regex.test(normalizedText)) {
      keywordMatches.push(keyword);
    }
  }

  for (const rule of config.patterns || []) {
    const regex = new RegExp(rule.pattern, 'gi');
    const match = regex.exec(normalizedText);
    if (match) {
      patternMatches.push({
        ruleId: rule.id,
        name: rule.name,
        action: rule.action,
        match: match[0]
      });
    }
  }

  const matched = keywordMatches.length > 0 || patternMatches.length > 0;
  return {
    detector: 'SECRET',
    matched,
    action: matched ? 'BLOCK' : 'ALLOW',
    severity: matched ? 'HIGH' : 'LOW',
    keywords: keywordMatches,
    matches: patternMatches
  };
}

module.exports = { detectSecrets };
