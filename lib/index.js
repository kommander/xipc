'use strict';
const fork = require('child_process').fork;
const path = require('path');

const cache = {};
let ids = 0;
const defaultSettings = {
  workers: 4,
};

const getWorker = (resolvedPath) => {
  let cacheResult = cache[resolvedPath] ? cache[resolvedPath] : null;
  if (!cacheResult) {
    const callbacks = {};
    cacheResult = cache[resolvedPath] = {
      callbacks,
      workers: [],
    };

    for (let i = 0; i < defaultSettings.workers; i++) {
      const child = fork(path.resolve(__dirname, './run-fn'), [resolvedPath]);
      child
        .on('message', (msg) => {
          callbacks[msg.id].resolve(msg.result);
          callbacks[msg.id] = null;
        })
        .on('error', (err) => {
          callbacks[err.id].reject(err);
          callbacks[err.id] = null;
        });
      cacheResult.workers.push(child);
    }
  }
  return cacheResult;
};

const wrapFn = function(modulePath) {
  console.log('wrapping fn', process.pid);
  const resolvedPath = path.resolve(modulePath);

  const cacheResult = getWorker(resolvedPath);
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
      child.send({ id, args });
    });
  };
};

module.exports = {
  wrapFn,
};
