'use strict';

const fs = require('node:fs');
const path = require('node:path');

module.exports = function tempPath(name) {
  const directory = path.join(__dirname, '..', '.tmp');
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, name);
};
