'use strict';

const fn = function(s) {
  console.log('fn', process.pid);
  return s + 1;
};
module.exports = fn;
