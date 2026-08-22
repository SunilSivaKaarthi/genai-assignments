const express = require('express');
const multer = require('multer');
const { validateModerationRequest } = require('../middleware/validateRequest');
const { detectPII } = require('../detectors/piiDetector');
const { detectCII } = require('../detectors/ciiDetector');
const { detectSecrets } = require('../detectors/secretDetector');
const { detectPromptInjection } = require('../detectors/injectionDetector');
const { evaluateDetectorResults, buildPolicySummary } = require('../decision/decisionEngine');
const { maskContent } = require('../services/masking.service');
const { validateFile, extractTextFromFile } = require('../validators/fileValidator');
const { validateTokens } = require('../validators/tokenValidator');
const { normalize } = require('../utils/normalizeResult');
const { parseRequestContext, enrichResultsWithContext } = require('../utils/contextUtil');
const { sanitizeResultsForResponse } = require('../utils/safeResponseUtil');
const { getRolePolicy, canBypassHighSeverity, allowsDecision } = require('../utils/rolePolicyUtil');
const { loadModerationPolicy } = require('../utils/policyLoader');
const { logOperation } = require('../utils/logger.util');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

router.post('/', upload.single('file'), validateModerationRequest, async (req, res) => {
  const { text, input, content } = req.body;
  const file = req.file;
  const context = parseRequestContext(req.body);

  const policyConfig = loadModerationPolicy();
  const requestId = `REQ-${Date.now()}`;
  const rawContent = file ? extractTextFromFile(file) : (text || input || content || '');

  if (file && policyConfig.fileValidation?.enabled) {
    const fileValidation = await validateFile(file);
    if (fileValidation.action === 'BLOCK') {
      const normalizedValidation = normalize(fileValidation);
      normalizedValidation.metadata.requestContext = context;
      const statusCode = normalizedValidation.reason === 'PAYLOAD_TOO_LARGE' ? 413
        : normalizedValidation.reason === 'UNSUPPORTED_FILE_TYPE' ? 415
        : 403;

      return res.status(statusCode).json({
        requestId,
        decision: 'BLOCK',
        safe: false,
        reason: normalizedValidation.reason || 'MODERATION_POLICY_VIOLATION',
        policy: { severity: normalizedValidation.severity, categories: ['FILE'] },
        findings: [normalizedValidation]
      });
    }
  }

  const detectorList = [];

  if (policyConfig.pii?.enabled) {
    detectorList.push(() => detectPII(rawContent));
  }

  if (policyConfig.cii?.enabled) {
    detectorList.push(() => detectCII(rawContent));
  }

  if (policyConfig.secrets?.enabled) {
    detectorList.push(() => detectSecrets(rawContent));
  }

  if (policyConfig.promptInjection?.enabled) {
    detectorList.push(() => detectPromptInjection(rawContent, policyConfig.promptInjection?.blockThreshold));
  }

  if (policyConfig.tokenValidation?.enabled) {
    detectorList.push(() => validateTokens(rawContent));
  }

  const results = [];
  for (const detector of detectorList) {
    const detection = detector();
    results.push(detection);

    if (policyConfig.executionMode === 'fail-fast' && detection.action === 'BLOCK') {
      break;
    }
  }

  const normalizedResults = enrichResultsWithContext(results.map(normalize), context);
  const policy = buildPolicySummary(normalizedResults);
  let finalDecision = evaluateDetectorResults(normalizedResults, policyConfig.decisionPriority);
  const rolePolicy = getRolePolicy(context.role);

  if (policyConfig.executionMode === 'fail-fast') {
    const blockFound = normalizedResults.some(result => result.action === 'BLOCK');
    if (blockFound) {
      finalDecision = 'BLOCK';
    }
  }

  const hasHighSeverity = normalizedResults.some(result => result.severity === 'HIGH');
  const bypassAllowed = canBypassHighSeverity(context);

  if (hasHighSeverity && bypassAllowed) {
    finalDecision = 'MASK';
  }

  if (!allowsDecision(finalDecision, context)) {
    finalDecision = 'BLOCK';
  }

  const sanitizedFindings = sanitizeResultsForResponse(normalizedResults.filter(r => r.action !== 'ALLOW'));

  const commonResponse = {
    requestId,
    decision: finalDecision,
    safe: finalDecision !== 'BLOCK',
    reason: finalDecision === 'BLOCK' ? 'MODERATION_POLICY_VIOLATION' : undefined,
    policy: {
      ...policy,
      rolePolicy: rolePolicy
    },
    context,
    findings: sanitizedFindings
  };

  logOperation({
    requestId,
    decision: finalDecision,
    statusCode: finalDecision === 'BLOCK' ? 403 : 200,
    processingMs: Date.now() - Number(requestId.replace('REQ-', ''))
  });

  if (finalDecision === 'BLOCK') {
    return res.status(403).json(commonResponse);
  }

  if (finalDecision === 'MASK') {
    const masked = maskContent(rawContent, normalizedResults);
    return res.status(200).json({ ...commonResponse, content: masked });
  }

  return res.status(200).json({ ...commonResponse, content: rawContent });
});

module.exports = router;
