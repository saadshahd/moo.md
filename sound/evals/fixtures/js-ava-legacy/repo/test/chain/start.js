const test = require('ava');
const { chain } = require('../..');

test('returns start when end pass outcome is complete and pass type is not open-play', (t) => {
  const event = {
    name: 'pass',
    fields: { type: 'not-open-play', outcome: 'complete' }
  };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when ball-recovery state is not offensive and its outcome is complete', (t) => {
  const event = {
    name: 'ball-recovery',
    fields: { state: 'not-offensive', outcome: 'complete' }
  };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when fifty-fifty outcome is won', (t) => {
  const event = { name: 'fifty-fifty', fields: { outcome: 'won' } };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when duel outcome is won', (t) => {
  const event = { name: 'duel', fields: { outcome: 'won' } };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when interception outcome is won', (t) => {
  const event = { name: 'interception', fields: { outcome: 'won' } };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when camera-on', (t) => {
  const event = { name: 'camera-on' };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when goal-keeper outcome is won', (t) => {
  const event = { name: 'goal-keeper', fields: { outcome: 'won' } };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when goal-keeper outcome is claim', (t) => {
  const event = { name: 'goal-keeper', fields: { outcome: 'claim' } };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when goal-keeper outcome is collected-twice', (t) => {
  const event = {
    name: 'goal-keeper',
    fields: { outcome: 'collected-twice' }
  };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when goal-keeper outcome is saved-twice', (t) => {
  const event = {
    name: 'goal-keeper',
    fields: { outcome: 'saved-twice' }
  };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});

test('returns start when goal-keeper outcome is success and type is not punch', (t) => {
  const event = {
    name: 'goal-keeper',
    fields: { outcome: 'success', type: 'not-punch' }
  };

  const chainType = chain.getType(event);

  t.true(chainType === 'start');
});
