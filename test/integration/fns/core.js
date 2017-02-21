const ximpc = require('../../../lib');
require('should');

describe('Core XIMPC Function', () => {
  it('turns a function module in to workers', (done) => {
    const mod = ximpc.require('../../data/addition');
    mod(1).then((result) => {
      result.should.eql(2);
      done();
    }).catch((err) => {
      console.log('Err', err);
      done(err)
    });
  });
});
