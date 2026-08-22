const express = require('express');
const { evaluateDetectorResults } = require('../decision/decisionEngine');
const { normalize } = require('../utils/normalizeResult');

const router = express.Router();

router.post('/', (req, res) => {
  const results = Array.isArray(req.body.results) ? req.body.results.map(normalize) : [];
  const decision = evaluateDetectorResults(results, req.body.decisionPriority);

  res.status(200).json({
    requestId: `REQ-${Date.now()}`,
    decision,
    safe: decision !== 'BLOCK'
  });
});

module.exports = router;
