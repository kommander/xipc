'use strict';
console.log('run-fn', process.argv[2], process.pid);

const fn = require(process.argv[2]);

process.on('message', (msg) => {
  console.log('fn message', msg, process.pid);
  const result = fn.apply(null, msg.args);
  if (result instanceof Promise) {
    console.log('fn is promise', process.pid);
    return result.then((x) => process.send({ id: msg.id, result: x }));
  }
  process.send({ id: msg.id, result });
});
