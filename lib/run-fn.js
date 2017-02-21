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

// Initial Timeout
let workerTimeout = setTimeout(() => {
  process.exit(0);
}, 3000);

let settings = null;
let numJobs = 0;

const decrementJobs = () => {
  numJobs--;
  if (numJobs === 0) {
    workerTimeout = setTimeout(() => process.exit(0), settings.timeout);
  }
};

// TODO: profile method runtimes and create estimates for the queue.
//       >> calculate queue limitation based on summed queue estimate

process.on('message', (msg) => {
  if (msg.action) {
    if (msg.action === 'new') {
      fns[msg.path] = require(msg.path);
    } else if (msg.action === 'setup') {
      settings = msg.settings;
    }
    return;
  }

  // TODO: Make sure we don't fail hard on missing path
  const fn = fns[msg.path];

  clearTimeout(workerTimeout);
  numJobs++;

  const result = fn.apply(null, msg.args);
  if (result instanceof Promise) {
    return result.then((x) => {
      process.send({ id: msg.id, result: x });
      decrementJobs();
    });
  }
  process.send({ id: msg.id, result });
  decrementJobs();
});
