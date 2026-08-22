const { loadJsonConfig } = require('../utils/configLoader');

function basicTokenizer(text) {
  if (!text) return [];
  // Very simple tokenizer: split on whitespace and punctuation
  return String(text).split(/\s+|(?=[.,;:!?()\[\]{}"'])|(?<=[.,;:!?()\[\]{}"'])/).filter(Boolean);
}

function validateTokens(text) {
  const config = loadJsonConfig('token-rules.json');
  const max = config.maxInputTokens || 20000;
  const tokens = basicTokenizer(text);

  if (tokens.length > max) {
    return { detector: 'TOKEN', matched: true, action: 'BLOCK', severity: 'HIGH', metadata: { tokenCount: tokens.length, max } };
  }

  return { detector: 'TOKEN', matched: false, action: 'ALLOW', severity: 'LOW', metadata: { tokenCount: tokens.length, max } };
}

module.exports = { basicTokenizer, validateTokens };
