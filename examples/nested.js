const ximpc = require('../lib');
const nested = ximpc.require('./fns/nested');

nested().then((result) => console.log('result', result, nested.called));
