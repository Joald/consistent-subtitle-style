// Polyfill util.styleText for Node.js < 20.12 (used by ESLint 10 stylish formatter)
const util = require('util');
if (!util.styleText) {
  util.styleText = (_style, text) => text;
}
