function parseRequestContext(body) {
  if (!body || typeof body !== 'object') {
    return { role: 'anonymous', userId: null, sessionId: null, intent: null, trustLevel: null };
  }

  return {
    role: typeof body.role === 'string' ? body.role.toLowerCase() : 'anonymous',
    userId: typeof body.userId === 'string' ? body.userId : null,
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
    intent: typeof body.intent === 'string' ? body.intent : null,
    trustLevel: typeof body.trustLevel === 'string' ? body.trustLevel.toLowerCase() : null
  };
}

function enrichResultsWithContext(results, context) {
  if (!Array.isArray(results)) return results;
  return results.map((result) => ({
    ...result,
    metadata: {
      ...result.metadata,
      requestContext: context
    }
  }));
}

module.exports = { parseRequestContext, enrichResultsWithContext };