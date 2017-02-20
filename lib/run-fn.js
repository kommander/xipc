'use strict';
console.log('XIMPC: run-fn', process.pid);

const fns = {};

process.on('message', (msg) => {
  console.log('XIMPC: fn message', msg, process.pid);

  if (msg.action) {
    if (msg.action === 'new') {
      return fns[msg.path] = require(msg.path);
    }
  }

  const fn = fns[msg.path];

  const result = fn.apply(null, msg.args);
  if (result instanceof Promise) {
    console.log('XIMPC: fn is promise', process.pid);
    return result.then((x) => process.send({ id: msg.id, result: x }));
  }
  process.send({ id: msg.id, result });
});
