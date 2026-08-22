const severityRank = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

function normalizeSeverity(value) {
  if (!value) return 'LOW';
  const normalized = String(value).toUpperCase();
  return severityRank[normalized] ? normalized : 'LOW';
}

function severityForAction(action) {
  if (action === 'BLOCK') return 'HIGH';
  if (action === 'MASK') return 'MEDIUM';
  return 'LOW';
}

function getHighestSeverity(results) {
  if (!Array.isArray(results) || !results.length) return 'LOW';
  return results.reduce((highest, item) => {
    const current = normalizeSeverity(item.severity || severityForAction(item.action));
    return severityRank[current] > severityRank[highest] ? current : highest;
  }, 'LOW');
}

module.exports = { normalizeSeverity, severityForAction, getHighestSeverity, severityRank };
