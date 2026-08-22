function sanitizeMatchValue(match, detector) {
  if (typeof match !== 'string' || !match.length) {
    return match;
  }

  const key = String(detector || 'SENSITIVE').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return `<${key}_MASKED>`;
}

function sanitizeResultsForResponse(results) {
  if (!Array.isArray(results)) return results;

  return results.map((result) => {
    const sanitized = {
      ...result,
      matches: [],
      metadata: result.metadata ? { ...result.metadata } : {}
    };

    if (Array.isArray(result.matches)) {
      sanitized.matches = result.matches.map((match) => {
        const placeholder = sanitizeMatchValue(match.match, match.name || match.ruleId || result.detector);
        return {
          ruleId: match.ruleId || null,
          name: match.name || null,
          match: placeholder,
          action: match.action || result.action,
          score: match.score || null,
          severity: match.severity || result.severity
        };
      });
    }

    if (sanitized.metadata.requestContext) {
      sanitized.metadata = { requestContext: sanitized.metadata.requestContext };
    }

    return sanitized;
  });
}

module.exports = { sanitizeResultsForResponse };
