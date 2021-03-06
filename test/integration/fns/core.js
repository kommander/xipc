const ximpc = require('../../../lib');
const should = require('should');

describe('Core XIMPC Function', () => {
  it('turns a function module in to workers', (done) => {
    const mod = ximpc.require('../../data/addition');
    mod(1, 1).then((result) => {
      result.should.eql(2);
      done();
    }).catch((err) => {
      done(err)
    });
  });

  it('returns null when argument is missing', (done) => {
    const mod = ximpc.require('../../data/addition');
    mod(1).then((result) => {
      should(result).eql(NaN);
      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('returns the correct error from worker', (done) => {
    const mod = ximpc.require('../../data/error');

    mod().then(() => {
      done('we should not get here');
    }).catch((err) => {
      err.message.should.eql('XIMPC: process_error');
      done();
    });
  });

  it('runs calls round robin per default', (done) => {
    const mod = ximpc.require('../../data/pid');

    Promise.all([mod(), mod(), mod(), mod()]).then((results) => {
      results.reduce((prev, cur) => !prev.includes(cur) ? prev.concat([cur]) : prev, [])
        .length.should.eql(4);
      done();
    }).catch((err) => done(err));
  });

  it('provides a pre fn:send hook', (done) => {
    const mod = ximpc.require('../../data/pid');

    mod.pre('fn:send', (msg) => {
      return msg;
    });

    Promise.all([mod(), mod(), mod(), mod()]).then((results) => {
      results.reduce((prev, cur) => !prev.includes(cur) ? prev.concat([cur]) : prev, [])
        .length.should.eql(4);
      done();
    }).catch((err) => done(err));
  });

  it('handles missing module id on worker', (done) => {
    const mod = ximpc.require('../../data/addition');

    mod.pre('fn:send', (msg) => {
      msg.moduleId = 'invalid_id';
      return msg;
    });

    mod(1, 1).then(() => {
      done('should not get here');
    }).catch((err) => {
      err.should.have.property('message', 'XIMPC: cannot find module [invalid_id]');
      done();
    });
  });

  it('turns an object module in to workers', (done) => {
    const mod = ximpc.require('../../data/object');

    mod.fn(1, 1).then((result) => {
      result.should.eql(2);
      done();
    }).catch(done);
  });

  it('an object fn can rely on object privates', (done) => {
    const mod = ximpc.require('../../data/complex-object');

    mod.pAdd(1).then((result) => {
      result.should.eql(2);
      done();
    }).catch(done);
  });

  it('an object fn can rely on object this', (done) => {
    const mod = ximpc.require('../../data/complex-object');

    mod.that().then((result) => {
      should(result).eql('the string');
      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('works with sync functions as well', (done) => {
    const mod = ximpc.require('../../data/sync');

    Promise.all([mod(), mod(), mod(), mod()]).then((results) => {
      results.reduce((prev, cur) => !prev.includes(cur) ? prev.concat([cur]) : prev, [])
        .length.should.eql(4);
      done();
    }).catch((err) => done(err));
  });

  it('can connect to arbitrary function in network');
  it('handles returned object instances (prefer fn programming)');
  it('starts as many workers as specified in the default settings');
  it('does not load the same module twice');
  it('does not load itself twice after require cache flush');
  it('works in cluster setup');
  it('returns real values from worker (AMF maybe, not JSON, custom IPC channel)');
});
