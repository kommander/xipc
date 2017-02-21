'use strict';
const fork = require('child_process').fork;
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// TODO: Ensure is not loaded twice when require cache is cleared

const activeModules = [];
let ids = 0;
let roundRobin = 0;
const defaultSettings = {
  workers: 4,
  timeout: 3000,
};
const workers = [];
const callbacks = {};

const createWorker = () => {
  const child = fork(path.resolve(__dirname, './run-fn'), {
    env: {
      IS_WORKER: 'true',
    }
  });

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
  workers.forEach((child) => child.send({
    action: 'new',
    type: 'fn',
    path: resolvedPath,
  }));
};

const requireFn = function(modulePath) {
  const callerfile = getCallerFile();
  const fileParts = path.parse(callerfile);
  const resolvedPath = require.resolve(path.resolve(fileParts.dir, modulePath));

  const mod = require(resolvedPath);
  if (!mod || typeof mod !== 'function') throw new Error('XIMPC: Type not supported in ' + resolvedPath);

  // TODO: identify fns by their hash, only load once
  const moduleContent = fs.readFileSync(resolvedPath);
  const moduleId = crypto.createHash('sha256').update(moduleContent).digest('hex');

  if (process.env.IS_WORKER !== 'true') {
    propagateModule(resolvedPath);
    activeModules.push(resolvedPath);

    const fn = function XIMPCFunction() {
      fn.called++;
      const args = Array.prototype.slice.apply(arguments);

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

        const child = workers[roundRobin];
        roundRobin++;
        if (roundRobin === workers.length) {
          roundRobin = 0;
        }
        child.send({ id, path: resolvedPath, args });
      });
    };

    fn.called = 0;
    fn.path = resolvedPath;

    return fn;
  }

  const fn = function XIMPCFunction() {
    fn.called++;
    const args = Array.prototype.slice.apply(arguments);

    return Promise.resolve().then(function() {
      mod.apply(null, args);
    });
  };

  fn.called = 0;
  fn.path = resolvedPath;

  return fn;
};

module.exports = {
  require: requireFn,
};
