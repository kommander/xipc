'use strict';
console.log('run-fn', process.argv[2], process.pid);

const fn = require(process.argv[2]);

process.on('message', (msg) => {
  const result = fn.apply(null, msg.args);
  process.send({ id: msg.id, result });
});
