'use strict';
const fork = require('child_process').fork;
const path = require('path');

const cache = {};
let ids = 0;
const defaultSettings = {
  workers: 4,
};
const workers = [];
const callbacks = {};

// TODO: Exit workers when parent process exits or has no more pending tasks in event loop
for (let i = 0; i < defaultSettings.workers; i++) {
  const child = fork(path.resolve(__dirname, './run-fn'));
  workers.push(child);
}

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

const cacheModule = (resolvedPath) => {
  const mod = require(resolvedPath);
  if (!mod) throw new Error('XIMPC: Type not supported in ' + resolvedPath);

  let cacheResult = cache[resolvedPath] ? cache[resolvedPath] : null;
  if (!cacheResult) {
    const callbacks = {};
    cacheResult = cache[resolvedPath] = {
      callbacks,
      workers: workers.map((child) => {
        child
          .on('message', (msg) => {
            callbacks[msg.id].resolve(msg.result);
            callbacks[msg.id] = null;
          })
          .on('error', (err) => {
            // TODO: Make sure err from child always returns concurring message id
            if (!err.id) throw err;
            callbacks[err.id].reject(err);
            callbacks[err.id] = null;
          })
          .send({
            action: 'new',
            type: 'fn',
            path: resolvedPath,
          });
        return child;
      }),
    };
  }
  return cacheResult;
};

const requireFn = function(modulePath) {
  const callerfile = getCallerFile();
  const fileParts = path.parse(callerfile);
  const resolvedPath = path.resolve(fileParts.dir, modulePath);

  console.log('wrapping fn', fileParts, process.pid);

  const cacheResult = cacheModule(resolvedPath);
  let roundRobin = 0;

  return function() {
    console.log('calling rpc fn', resolvedPath, process.pid);

    return new Promise((resolve, reject) => {
      const id = ++ids;

      cacheResult.callbacks[id] = {
        resolve,
        reject,
      };

      const args = Array.prototype.slice.apply(arguments);

      const child = cacheResult.workers[roundRobin];
      roundRobin++;
      if (roundRobin === cacheResult.workers.length) {
        roundRobin = 0;
      }
      child.send({ id, path: resolvedPath, args });
    });
  };
};

module.exports = {
  require: requireFn,
};
