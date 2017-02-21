const addition = require('./addition');

const privateNum = 1;

module.exports = {
  value: 'the string',
  addition,
  pAdd: (num) => num + privateNum,
  that: function() {
    return this.value;
  },
};
