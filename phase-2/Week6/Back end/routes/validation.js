const express = require('express');
const multer = require('multer');
const { validateFile } = require('../validators/fileValidator');
const { validateTokens } = require('../validators/tokenValidator');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

router.post('/file', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded for validation.' });
  }

  const result = await validateFile(file);
  res.json(result);
});

router.post('/tokens', (req, res) => {
  const { text, input, content } = req.body;
  const raw = text || input || content || '';
  const result = validateTokens(raw);
  res.json(result);
});

module.exports = router;
