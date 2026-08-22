const fileType = require('file-type');
const path = require('path');
const { loadJsonConfig } = require('../utils/configLoader');

async function validateFile(file) {
  const config = loadJsonConfig('file-rules.json');
  if (!file) {
    return { detector: 'FILE', matched: false, action: 'ALLOW' };
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const maxBytes = (config.maxFileSizeMB || 5) * 1024 * 1024;

  if (file.size > maxBytes) {
    return {
      detector: 'FILE',
      matched: true,
      action: 'BLOCK',
      severity: 'HIGH',
      reason: 'PAYLOAD_TOO_LARGE',
      metadata: { fileSize: file.size, maxBytes }
    };
  }

  if (!config.allowedExtensions.includes(ext)) {
    return {
      detector: 'FILE',
      matched: true,
      action: 'BLOCK',
      severity: 'HIGH',
      reason: 'UNSUPPORTED_FILE_TYPE',
      metadata: { extension: ext }
    };
  }

  const buffer = file.buffer || Buffer.from('');
  const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);
  if (fileTypeResult && config.allowedMimeTypes && config.allowedMimeTypes[ext]) {
    const detected = fileTypeResult.mime;
    const expected = config.allowedMimeTypes[ext];
    if (detected !== expected) {
      return {
        detector: 'FILE',
        matched: true,
        action: 'BLOCK',
        severity: 'HIGH',
        reason: 'MIME_MISMATCH',
        metadata: { extension: ext, declaredMime: file.mimetype, detectedMime: detected }
      };
    }
  }

  if (file.mimetype && file.mimetype === 'application/x-msdos-program') {
    return {
      detector: 'FILE',
      matched: true,
      action: 'BLOCK',
      severity: 'HIGH',
      reason: 'POTENTIAL_EXECUTABLE',
      metadata: { mimetype: file.mimetype }
    };
  }

  return { detector: 'FILE', matched: false, action: 'ALLOW' };
}

function extractTextFromFile(file) {
  if (!file) return '';
  const name = (file.originalname || '').toLowerCase();
  const buffer = file.buffer || Buffer.from('');

  if (name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.json')) {
    return buffer.toString('utf8');
  }

  return '';
}

module.exports = { validateFile, extractTextFromFile };
