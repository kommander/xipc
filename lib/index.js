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
    const callback = callbacks[msg.id];
    if (!callback) throw new Error('Something is very wrong.');

    if (msg.result) {
      let result = msg.result;
      if (result.__type === 'NaN') {
        result = NaN;
      }

      callback.resolve(result);
    } else {
      callback.reject(new Error(msg.error.message));
    }

    callbacks[msg.id] = null;
  })
  .on('error', (err) => {
    // TODO: Make sure err from child always returns concurring message id
    if (!err.id) throw err;
    callbacks[err.id].reject(err);
    callbacks[err.id] = null;
  });

  child.send({ action: 'setup', settings: defaultSettings });

  activeModules.forEach((mod) => child.send({
    moduleId: mod.moduleId,
    action: 'new',
    type: 'fn',
    path: mod.path,
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

const propagateModule = (moduleId, resolvedPath) => {
  workers.forEach((child) => child.send({
    moduleId,
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
  // Implementation independent function identifier
  let content = `${mod.name}`;
  if (!mod.name) {
    content = `${content}|${Date.now()}`;
  }
  const moduleId = crypto.createHash('sha256').update(content).digest('hex');

  if (process.env.IS_WORKER !== 'true') {
    propagateModule(moduleId, resolvedPath);
    activeModules.push({
      moduleId: moduleId,
      path: resolvedPath,
    });

    const fn = function XIMPCFunction() {
      fn.called++;

      const args = Array.prototype.slice.apply(arguments);

      return Promise.resolve().then(() => new Promise((resolve, reject) => {
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

        const msg = (fn.hooks['fn:send'] || []).reduce((prev, hook) => hook(prev), { id, moduleId, args });
        child.send(msg);
      }));
    };

    fn.called = 0;
    fn.path = resolvedPath;
    fn.hooks = {};
    fn.pre = (hook, cb) => {
      if (!fn.hooks[hook]) fn.hooks[hook] = [];
      fn.hooks[hook].push(cb);
    };


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
