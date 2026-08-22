const { getHighestSeverity } = require('../utils/policyUtil');

function evaluateDetectorResults(results, decisionPriority = ['BLOCK', 'MASK', 'ALLOW']) {
  if (!Array.isArray(results)) {
    return 'ALLOW';
  }

  for (const decision of decisionPriority) {
    if (decision === 'ALLOW') {
      continue;
    }

    if (results.some((result) => result.action === decision)) {
      return decision;
    }
  }

  return 'ALLOW';
}

function buildPolicySummary(results) {
  const severity = getHighestSeverity(results);
  const categories = Array.from(new Set(results.map(result => result.detector))).filter(Boolean);
  return { severity, categories };
}

module.exports = { evaluateDetectorResults, buildPolicySummary };
