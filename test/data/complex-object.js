const addition = require('./addition');

const privateNum = 1;

module.exports = {
  addition,
  pAdd: (num) => num + privateNum,
};
