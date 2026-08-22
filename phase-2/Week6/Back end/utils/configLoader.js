const fs = require('fs');
const path = require('path');

const cache = {};

function loadJsonConfig(filename) {
  if (cache[filename]) {
    return cache[filename];
  }

  const filePath = path.resolve(__dirname, '../../config', filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  cache[filename] = parsed;
  return parsed;
}

module.exports = { loadJsonConfig };
