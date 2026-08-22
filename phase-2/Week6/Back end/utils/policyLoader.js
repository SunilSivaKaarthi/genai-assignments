const { loadJsonConfig } = require('./configLoader');

function loadModerationPolicy() {
  return loadJsonConfig('moderation-policy.json');
}

module.exports = { loadModerationPolicy };
