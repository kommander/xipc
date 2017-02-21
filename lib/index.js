'use strict';

const fork = require('child_process').fork;
const path = require('path');
const crypto = require('crypto');

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
      const err = new Error(msg.error.message);
      callback.reject(err);
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
    action: mod.type === 'function' ? 'new:fn' : 'new:obj',
    type: 'fn',
    path: mod.path,
  }));

  return child;
};

// TODO: Exit workers when parent process exits or has no more pending tasks in event loop

if (process.env.IS_WORKER !== 'true') {
  process.on('disconnect', () => {
    // console.log('master process disconnect');
  });

  process.on('exit', () => {
    // console.log('master process exit');
  });

  process.on('beforeExit', () => {
    // console.log('master process beforeExit');
  });

  process.on('SIGINT', () => {
    // console.log('Received SIGINT.');
  });

  process.on('uncaughtException', (err) => {
    console.log('master process uncaughtException:', err.message, err); // eslint-disable-line
  });
}

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
  } catch (err) {
    return undefined;
  }
  return undefined;
}

const propagateModule = (moduleId, type, resolvedPath, keys) => {
  workers.forEach((child) => child.send({
    moduleId,
    action: type === 'function' ? 'new:fn' : 'new:obj',
    type,
    path: resolvedPath,
    keys,
  }));
};

const createXIMPCFunction = function(moduleId, type, key, resolvedPath) {
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

      let msg;

      if (!key) {
        msg = (fn.hooks['fn:send'] || []).reduce((prev, hook) => hook(prev), { action: 'fn', id, moduleId, args });
      } else if (key && type === 'object') {
        msg = (fn.hooks['obj:send'] || []).reduce((prev, hook) => hook(prev), { action: 'obj:fn', id, moduleId, key, args });
      }
      child.send(msg);
    }));
  };

  fn.called = 0;
  fn.path = resolvedPath;
  fn.hooks = {};
  fn.pre = (hook, cb) => {
    if (!fn.hooks[hook]) fn.hooks[hook] = [];
    fn.hooks[hook].push(cb);
  }

  return fn;
};

const requireFn = function(modulePath) {
  const callerfile = getCallerFile();
  const fileParts = path.parse(callerfile);
  const resolvedPath = require.resolve(path.resolve(fileParts.dir, modulePath));

  const mod = require(resolvedPath);
  const type = typeof mod;
  if (!mod || (type !== 'function' && type !== 'object')) {
     throw new Error(`XIMPC: Type "${type}" not supported from ${resolvedPath}`);
  }

  // TODO: identify fns by their hash, only load once
  // Implementation independent function identifier
  let content = `${mod.name}`;
  if (!mod.name) {
    content = `${content}|${Date.now()}`;
  }
  const moduleId = crypto.createHash('sha256').update(content).digest('hex');

  if (process.env.IS_WORKER !== 'true') {
    propagateModule(moduleId, type, resolvedPath);
    activeModules.push({
      type,
      moduleId,
      path: resolvedPath,
    });

    if (type === 'function') {
      const fn = createXIMPCFunction(moduleId, type, null, resolvedPath);
      return fn;
    } else if (type === 'object') {
      const obj = {};
      const keys = {};

      Object.keys(mod)
        .filter((key) => mod.hasOwnProperty(key))
        .forEach((key) => {
          const memberType = typeof mod[key];
          keys[key] = {
            type: memberType,
          };
          if (memberType === 'function') {
            obj[key] = createXIMPCFunction(moduleId, type, key, resolvedPath);
          }
        });

      propagateModule(moduleId, type, resolvedPath, keys);

      return obj;
    }
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
