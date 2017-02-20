const path = require('path');
const fibonacci = require('./fibonacci');
const ximpc = require('../lib');
const wrappedFibonacci = ximpc.wrapFn(path.resolve(__dirname, './fibonacci'));

const factor = 1000000000;
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
