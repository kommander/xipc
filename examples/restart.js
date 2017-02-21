const ximpc = require('../lib');
const wrappedFibonacci = ximpc.require('./fns/fibonacci');

const factor = 100000;
let startTime = Date.now();
const promises = [];

for (let i = 0; i < 100; i++) {
  promises.push(wrappedFibonacci(factor));
}

Promise.all(promises)
  .then((results) => {
    console.log('Num Results:', results.length);
    const duration = Date.now() - startTime;
    console.log('Duration XIMPC:', duration, 'ms');
  })
  .then(() => new Promise((resolve) => setTimeout(resolve, 4000)))
  .then(() => {
    const newPromises = [];
    for (let i = 0; i < 100; i++) {
      newPromises.push(wrappedFibonacci(factor));
    }
    startTime = Date.now();
    return Promise.all(newPromises);
  })
  .then((results) => {
    console.log('Num Results:', results.length);
    const duration = Date.now() - startTime;
    console.log('Duration XIMPC:', duration, 'ms');
  })
  .then(() => new Promise((resolve) => setTimeout(resolve, 4000)))
  .then(() => {
    const newPromises = [];
    for (let i = 0; i < 100; i++) {
      newPromises.push(wrappedFibonacci(factor));
    }
    startTime = Date.now();
    return Promise.all(newPromises);
  })
  .then((results) => {
    console.log('Num Results:', results.length);
    const duration = Date.now() - startTime;
    console.log('Duration XIMPC:', duration, 'ms');
  })
  .then(() => new Promise((resolve) => setTimeout(resolve, 4000)))
  .then(() => {
    const newPromises = [];
    for (let i = 0; i < 100; i++) {
      newPromises.push(wrappedFibonacci(factor));
    }
    startTime = Date.now();
    return Promise.all(newPromises);
  })
  .then((results) => {
    console.log('Num Results:', results.length);
    const duration = Date.now() - startTime;
    console.log('Duration XIMPC:', duration, 'ms');
  });
