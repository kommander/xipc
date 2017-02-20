'use strict';
console.log('XIMPC: run-fn', process.pid);

const fns = {};

process.on('disconnect', () => {
  console.log('XIMPC: run-fn disconnect');
});

process.on('exit', () => {
  console.log('XIMPC: run-fn exit');
});

process.on('beforeExit', () => {
  console.log('XIMPC: run-fn beforeExit');
});

let workerTimeout = null;

process.on('message', (msg) => {
  console.log('XIMPC: fn message', msg, process.pid);

  clearTimeout(workerTimeout);
  workerTimeout = setTimeout(() => process.exit(0), 5000);

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
