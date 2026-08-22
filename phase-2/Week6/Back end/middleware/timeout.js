const TIMEOUT_MS = 5000;

function timeoutMiddleware(req, res, next) {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (!res.headersSent) {
      res.status(503).json({
        requestId: `REQ-${Date.now()}`,
        error: 'REQUEST_TIMEOUT'
      });
    }
  }, TIMEOUT_MS);

  const cleanup = () => {
    clearTimeout(timer);
  };

  res.on('finish', cleanup);
  res.on('close', cleanup);

  req.on('close', cleanup);

  if (timedOut) {
    return;
  }

  next();
}

module.exports = { timeoutMiddleware };
