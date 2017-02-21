const ximpc = require('../../lib');
const wrappedFibonacci = ximpc.require('./fibonacci');

const nested = () => {
  return wrappedFibonacci(1000).then((result) => 'har');
};

module.exports = nested;
