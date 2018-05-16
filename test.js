'use strict';
const ximpc = require('./lib');
const fn = ximpc.require('./fn');
fn(1).then((result) => {
  console.log('result:', result);
});
fn(2).then((result) => {
  console.log('result:', result);
});
fn(3).then((result) => {
  console.log('result:', result);
});
