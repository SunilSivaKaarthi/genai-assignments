function validateModerationRequest(req, res, next) {
  const hasText = Boolean(req.body && (req.body.text || req.body.input || req.body.content));
  const hasFile = Boolean(req.file);

  if (!hasText && !hasFile) {
    return res.status(400).json({
      error: 'Request must include either text/content or a file upload.'
    });
  }

  if (hasText && hasFile) {
    return res.status(400).json({
      error: 'Request must include only one source: text or file.'
    });
  }

  next();
}

module.exports = { validateModerationRequest };
