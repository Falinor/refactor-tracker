const fs = require('fs');
const path = require('path');

function readConfig(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

module.exports = { readConfig };
