'use strict';
const fork = require('child_process').fork;
const path = require('path');

const activeModules = [];
let ids = 0;
const defaultSettings = {
  workers: 8,
  timeout: 3000,
};
const workers = [];
const callbacks = {};

const createWorker = () => {
  const child = fork(path.resolve(__dirname, './run-fn'));

  child.on('disconnect', () => {
    workers.splice(workers.indexOf(child), 1);
  });
  child.on('message', (msg) => {
    callbacks[msg.id].resolve(msg.result);
    callbacks[msg.id] = null;
  })
  .on('error', (err) => {
    // TODO: Make sure err from child always returns concurring message id
    if (!err.id) throw err;
    callbacks[err.id].reject(err);
    callbacks[err.id] = null;
  });

  child.send({ action: 'setup', settings: defaultSettings });

  activeModules.forEach((path) => child.send({
    action: 'new',
    type: 'fn',
    path: path,
  }));

  return child;
};

// TODO: Exit workers when parent process exits or has no more pending tasks in event loop

process.on('disconnect', () => {
  console.log('master process exit');
});

// Hack from stack overflow: http://stackoverflow.com/questions/16697791/nodejs-get-filename-of-caller-function
// Should be solved natively
function getCallerFile() {
  try {
    const err = new Error();

    Error.prepareStackTrace = function (err, stack) { return stack; };

    const currentfile = err.stack.shift().getFileName();

    while (err.stack.length) {
        const callerfile = err.stack.shift().getFileName();

        if(currentfile !== callerfile) return callerfile;
    }
  } catch (err) {}
  return undefined;
}

const propagateModule = (resolvedPath) => {
  const mod = require(resolvedPath);
  if (!mod) throw new Error('XIMPC: Type not supported in ' + resolvedPath);

  workers.forEach((child) => child.send({
    action: 'new',
    type: 'fn',
    path: resolvedPath,
  }));
};

const requireFn = function(modulePath) {
  const callerfile = getCallerFile();
  const fileParts = path.parse(callerfile);
  const resolvedPath = path.resolve(fileParts.dir, modulePath);

  propagateModule(resolvedPath);
  activeModules.push(resolvedPath);

  let roundRobin = 0;

  return function() {
    return new Promise((resolve, reject) => {
      const id = ++ids;

      callbacks[id] = {
        resolve,
        reject,
      };

      if (workers.length < defaultSettings.workers) {
        const missingWorkers = defaultSettings.workers - workers.length;
        for (let i = 0; i < missingWorkers; i++) {
          const child = createWorker();
          workers.push(child);
        }
      }

      const args = Array.prototype.slice.apply(arguments);

      const child = workers[roundRobin];
      roundRobin++;
      if (roundRobin === workers.length) {
        roundRobin = 0;
      }
      child.send({ id, path: resolvedPath, args });
    });
  };
};

module.exports = {
  require: requireFn,
};
