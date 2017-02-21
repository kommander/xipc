'use strict';
// console.log('XIMPC: run-fn startup', process.pid);

const fns = {};

process.on('disconnect', () => {
  // console.log('XIMPC: run-fn disconnect');
});

process.on('exit', () => {
  // console.log('XIMPC: run-fn exit');
});

process.on('beforeExit', () => {
  // console.log('XIMPC: run-fn beforeExit');
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
    type: typeof err,
    isError: err instanceof Error,
    code: err.code || err.name || 'UnknownWorkerError',
    message: err.message || 'XIMPC: UnknownWorkerError',
  };
  return res;
};

process.on('message', (msg) => {
  if (msg.action) {
    if (msg.action === 'new') {
      fns[msg.moduleId] = {
        moduleId: msg.moduleId,
        path: msg.path,
        mod: require(msg.path),
      };
    } else if (msg.action === 'setup') {
      settings = msg.settings;
    }
    return;
  }

  // TODO: Make sure we don't fail hard on missing path
  const fn = fns[msg.moduleId].mod;

  clearTimeout(workerTimeout);
  numJobs++;

  try {
    const result = fn.apply(null, msg.args);

    if (result instanceof Promise) {
      return result.then((x) => {
        decrementJobs();

        // TODO: Use AMF here to transfer real types (and non-types)
        let result = x;

        if (isNaN(result)) {
          result = {
            __type: 'NaN',
          };
        }

        process.send({ id: msg.id, result });
      }).catch((error) => {
        process.send({ id: msg.id, error: parseError(error) });
      });
    }

    decrementJobs();
    process.send({ id: msg.id, result });
  } catch (error) {
    return process.send({ id: msg.id, error: parseError(error) });
  }
});
