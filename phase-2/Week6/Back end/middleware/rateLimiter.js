const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const store = new Map();

function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expires <= now) {
      store.delete(key);
    }
  }
}

function rateLimiter(req, res, next) {
  cleanupOldEntries();
  const key = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || entry.expires <= now) {
    entry = { count: 0, expires: now + RATE_LIMIT_WINDOW_MS };
    store.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((entry.expires - now) / 1000);
    return res.status(429).json({
      requestId: `REQ-${Date.now()}`,
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds
    });
  }

  next();
}

module.exports = { rateLimiter };
