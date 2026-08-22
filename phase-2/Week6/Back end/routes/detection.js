const express = require('express');
const { detectPII } = require('../detectors/piiDetector');
const { detectCII } = require('../detectors/ciiDetector');
const { detectSecrets } = require('../detectors/secretDetector');
const { detectPromptInjection } = require('../detectors/injectionDetector');
const { normalize } = require('../utils/normalizeResult');

const router = express.Router();

router.post('/pii', (req, res) => {
  const { text, input, content } = req.body;
  const raw = text || input || content || '';
  res.json(normalize(detectPII(raw)));
});

router.post('/cii', (req, res) => {
  const { text, input, content } = req.body;
  const raw = text || input || content || '';
  const result = detectCII(raw);
  const { normalize } = require('../utils/normalizeResult');
  res.json(normalize(result));
});

router.post('/secrets', (req, res) => {
  const { text, input, content } = req.body;
  const raw = text || input || content || '';
  const result = detectSecrets(raw);
  const { normalize } = require('../utils/normalizeResult');
  res.json(normalize(result));
});

router.post('/injection', (req, res) => {
  const { text, input, content } = req.body;
  const raw = text || input || content || '';
  const result = detectPromptInjection(raw);
  const { normalize } = require('../utils/normalizeResult');
  res.json(normalize(result));
});

module.exports = router;
