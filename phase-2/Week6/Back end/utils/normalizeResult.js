const { normalizeSeverity, severityForAction } = require('./policyUtil');

function normalize(result) {
  if (!result || typeof result !== 'object') return result;

  const action = result.action || (result.matched ? 'BLOCK' : 'ALLOW');
  const baseSeverity = normalizeSeverity(result.severity || severityForAction(action));

  const base = {
    detector: result.detector || 'UNKNOWN',
    matched: Boolean(result.matched),
    action,
    severity: baseSeverity,
    reason: result.reason || null,
    matches: [],
    metadata: result.metadata || {}
  };

  // Normalize matches from several possible shapes
  if (Array.isArray(result.matches) && result.matches.length) {
    base.matches = result.matches.map((m) => {
      if (typeof m === 'string') return { match: m, severity: baseSeverity };
      const actionForMatch = m.action || action;
      return {
        ruleId: m.ruleId || m.id || null,
        name: m.name || null,
        match: m.match || m.matched || m.pattern || null,
        action: actionForMatch,
        score: m.score || null,
        severity: normalizeSeverity(m.severity || severityForAction(actionForMatch))
      };
    });
  }

  // Secret detector may expose keywords array
  if (Array.isArray(result.keywords) && result.keywords.length) {
    base.matches.push(...result.keywords.map(k => ({ match: k, severity: baseSeverity })));
    base.matched = true;
    base.action = base.action || 'BLOCK';
    base.severity = normalizeSeverity(result.severity || severityForAction(base.action));
  }

  // For injection detector, include score
  if (typeof result.score === 'number') {
    base.metadata.score = result.score;
    base.metadata.threshold = result.threshold || null;
    base.matched = base.matched || (result.score > 0);
    base.action = result.action || base.action;
    base.severity = normalizeSeverity(result.severity || severityForAction(base.action));
  }

  return base;
}

module.exports = { normalize };
