'use strict';
// console.log('XIMPC: run-fn startup', process.pid);

const fns = {};
const objs = {};

process.on('disconnect', () => {
  // console.log('XIMPC: run-fn disconnect'); // eslint-disable-line
});

process.on('exit', () => {
  // console.log('XIMPC: run-fn exit');
});

process.on('beforeExit', () => {
  // console.log('XIMPC: run-fn beforeExit');
});

process.on('unhandledRejection', (reason) => {
  throw reason;
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

const parseError = (err) => {
  const res = {
    type: err.type || typeof err,
    isError: err.isError || err instanceof Error,
    code: err.code || err.name || 'UnknownWorkerError',
    message: 'XIMPC: ' + err.message || 'XIMPC: UnknownWorkerError',
  };
  return res;
};


const parsedResult = (result, msg) => {
  if (result instanceof Promise) {
    return result.then((x) => {

      // TODO: Use AMF here to transfer real types (and non-types)
      let result = x;

      if (isNaN(result)) {
        result = {
          __type: 'NaN',
        };
      }

      return { id: msg.id, result };
    }).catch((error) => {
      return { id: msg.id, error: parseError(error) };
    });
  }

  return { id: msg.id, result };
};

const handleFnMsg = (mod, msg) => {
  return Promise.resolve().then(() => {
    try {
      const fn = mod.fn;
      const result = fn.apply(null, msg.args);

      return parsedResult(result, msg);
    } catch (error) {
      return { id: msg.id, error: parseError(error) };
    }
  });
};

const handleObjFnMsg = (mod, msg) => {
  return Promise.resolve().then(() => {
    try {
      const obj = mod.obj;
      const result = obj[msg.key].apply(null, msg.args);

      return parsedResult(result, msg);
    } catch (error) {
      return { id: msg.id, error: parseError(error) };
    }
  });
};

process.on('message', (msg) => {
  if (msg.action) {
    let handler;
    let mod;

    if (msg.action === 'new:fn') {
      fns[msg.moduleId] = {
        moduleId: msg.moduleId,
        path: msg.path,
        fn: require(msg.path),
      };
      return;
    } else if (msg.action === 'new:obj') {
      objs[msg.moduleId] = {
        moduleId: msg.moduleId,
        path: msg.path,
        obj: require(msg.path),
        keys: msg.keys,
      };
      return;
    } else if (msg.action === 'setup') {
      settings = msg.settings;
      return;
    } else if (msg.action === 'fn') {
      // TODO: Make sure we don't fail hard on missing path
      mod = fns[msg.moduleId];

      if (!mod) {
        return process.send({
          id: msg.id,
          error: parseError({
            type: 'ReferenceError',
            isError: true,
            code: 'cannot find module',
            message: 'cannot find module',
          }),
        });
      }
      handler = handleFnMsg;
    } else if (msg.action === 'obj:fn') {
      mod = objs[msg.moduleId];

      if (!mod) {
        return process.send({
          id: msg.id,
          error: parseError({
            type: 'ReferenceError',
            isError: true,
            code: 'cannot find module',
            message: 'cannot find module',
          }),
        });
      }
      handler = handleObjFnMsg;
    } else {
      return;
    }

    clearTimeout(workerTimeout);
    numJobs++;

    handler(mod, msg).then((answer) => {
      decrementJobs();
      process.send(answer)
    })
    .catch((err) => console.log('handle', err)); // eslint-disable-line
  }
});
