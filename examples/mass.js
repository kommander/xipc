const ximpc = require('../lib');
const wrappedFibonacci = ximpc.require('./fns/fibonacci');

const factor = 10000000;
let startTime = Date.now();
const promises = [];

for (let i = 0; i < 10000; i++) {
  promises.push(wrappedFibonacci(factor));
}

Promise.all(promises).then((results) => {
  console.log('Num Results:', results.length);
  const duration = Date.now() - startTime;
  console.log('Duration XIMPC:', duration, 'ms');
});
