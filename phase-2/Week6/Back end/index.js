const express = require('express');
const moderationRouter = require('./routes/moderation');
const detectionRouter = require('./routes/detection');
const validationRouter = require('./routes/validation');
const decisionRouter = require('./routes/decision');

const app = express();
const port = process.env.PORT || 3000;

const { rateLimiter } = require('./middleware/rateLimiter');
const { timeoutMiddleware } = require('./middleware/timeout');

app.use(rateLimiter);
app.use(timeoutMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/moderate', moderationRouter);
app.use('/api/v1/detect', detectionRouter);
app.use('/api/v1/validate', validationRouter);
app.use('/api/v1/decision', decisionRouter);

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.warn('Invalid JSON payload received');
    return res.status(400).json({
      error: 'Invalid JSON payload.'
    });
  }

  next(err);
});

app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  const requestId = `REQ-${Date.now()}`;
  console.error({ requestId, error: err.message, stack: err.stack });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    requestId,
    error: 'MODERATION_FAILED'
  });
});

app.listen(port, () => {
  console.log(`Moderation service running on http://localhost:${port}`);
});
