'use strict';
const fork = require('child_process').fork;
const path = require('path');

const cache = {};
let ids = 0;

module.exports = function(modulePath) {
  console.log('wrapping fn', process.pid);
  const resolvedPath = path.resolve(modulePath);

  let cacheResult = cache[resolvedPath] ? cache[resolvedPath] : null;
  if (!cacheResult) {
    const child = fork(path.resolve(__dirname, './run-fn'), [resolvedPath]);
    const callbacks = {};
    cacheResult = cache[resolvedPath] = {
      child,
      callbacks,
    };
    child
      .on('message', (msg) => {
        callbacks[msg.id].resolve(msg.result);
        callbacks[msg.id] = null;
      })
      .on('error', (err) => {
        callbacks[err.id].reject(err);
        callbacks[err.id] = null;
      });
  }

  return function() {
    console.log('calling rpc fn', resolvedPath, process.pid);

    return new Promise((resolve, reject) => {
      const id = ++ids;

      cacheResult.callbacks[id] = {
        resolve,
        reject,
      };

      const args = Array.prototype.slice.apply(arguments);

      cacheResult.child.send({ id, args });
    });
  };
};
