'use strict';
console.log('XIMPC: run-fn startup', process.pid);

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
let settings = null;

process.on('message', (msg) => {
  if (msg.action) {
    if (msg.action === 'new') {
      return fns[msg.path] = require(msg.path);
    } else if (msg.action === 'setup') {
      settings = msg.settings;
      return;
    }
  }

  clearTimeout(workerTimeout);
  workerTimeout = setTimeout(() => process.exit(0), settings.timeout);

  const fn = fns[msg.path];

  const result = fn.apply(null, msg.args);
  if (result instanceof Promise) {
    return result.then((x) => process.send({ id: msg.id, result: x }));
  }
  process.send({ id: msg.id, result });
});
