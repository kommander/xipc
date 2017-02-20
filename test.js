'use strict';
const wrap = require('./lib');
const fn = wrap('./fn');
fn(1).then((result) => {
  console.log('result:', result);
});
fn(2).then((result) => {
  console.log('result:', result);
});
fn(3).then((result) => {
  console.log('result:', result);
});
