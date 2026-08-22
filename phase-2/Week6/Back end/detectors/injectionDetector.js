const { loadJsonConfig } = require('../utils/configLoader');
const { escapeRegExp } = require('../utils/regexUtil');

function detectPromptInjection(text) {
  const config = loadJsonConfig('injection-rules.json');
  const normalizedText = String(text || '');
  const lowerText = normalizedText.toLowerCase();
  let score = 0;
  const matches = [];

  for (const rule of config.rules || []) {
    const regex = new RegExp(escapeRegExp(rule.pattern), 'i');
    if (regex.test(lowerText)) {
      score += rule.score || 0;
      matches.push({
        ruleId: rule.id,
        name: rule.name,
        score: rule.score,
        pattern: rule.pattern
      });
    }
  }

  const threshold = config.threshold || 60;
  const action = score >= threshold ? 'BLOCK' : 'ALLOW';
  const severity = score >= threshold ? 'HIGH' : (score > 0 ? 'MEDIUM' : 'LOW');

  return {
    detector: 'PROMPT_INJECTION',
    matched: matches.length > 0,
    score,
    threshold,
    action,
    severity,
    matches
  };
}

module.exports = { detectPromptInjection };
