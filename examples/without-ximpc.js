const fibonacci = require('./fns/fibonacci');
const ximpc = require('../lib');
const wrappedFibonacci = ximpc.require('./fns/fibonacci');

const factor = 10000000;
let startTime = Date.now();

Promise.all([
  fibonacci(factor),
  fibonacci(factor),
  fibonacci(factor),
  fibonacci(factor),
]).then((results) => {
  console.log(results);
  const duration = Date.now() - startTime;
  console.log('Duration Blocking:', duration, 'ms');
}).then(() => {
  startTime = Date.now();
  return Promise.all([
    wrappedFibonacci(factor),
    wrappedFibonacci(factor),
    wrappedFibonacci(factor),
    wrappedFibonacci(factor),
  ])
}).then((results) => {
  console.log(results);
  const duration = Date.now() - startTime;
  console.log('Duration XIMPC:', duration, 'ms');
});
