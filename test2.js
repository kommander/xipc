'use strict';
const wrap = require('./wrap');
const fn = function() {
  return 2;
};
module.exports = wrap(fn);
