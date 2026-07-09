const test = require('ava');
const { isFn } = require('../helpers');
const { validator } = require('..');

test('returns validator object with expected methods', (t) => {
  t.truthy(validator);

  t.truthy(validator.validator);
  t.truthy(isFn(validator.validator));

  t.truthy(validator.is);
  t.truthy(isFn(validator.is));

  t.truthy(validator.getType);
  t.truthy(isFn(validator.getType));

  t.truthy(validator.getMayBeTypes);
  t.truthy(isFn(validator.getMayBeTypes));
});

test('should compile the basic rule correctly ', (t) => {
  const rules = { valid: ['offside'] };
  const event = { name: 'offside' };

  t.true(validator.is(rules, 'valid', event));
});

test('should compile the basic rule with fields correctly', (t) => {
  const rules = { valid: ['offside field hi is cool'] };
  const event = { name: 'offside', fields: { hi: 'cool' } };

  t.true(validator.is(rules, 'valid', event));
});

test('should compile the basic rule with negated fields correctly', (t) => {
  const rules = { valid: ['offside field hi is not cool'] };
  const event = { name: 'offside', fields: { hi: 'not-cool' } };

  t.true(validator.is(rules, 'valid', event));
});

test('should compile the basic rule with one of fields correctly', (t) => {
  const rules = { valid: ['offside field hi is one of boy man female'] };
  const event = { name: 'offside', fields: { hi: 'man' } };

  t.true(validator.is(rules, 'valid', event));
});

test('should compile the basic rule with negated one of fields correctly', (t) => {
  const rules = { valid: ['offside field hi is not one of boy man female'] };
  const event = { name: 'offside', fields: { hi: 'not-man' } };

  t.true(validator.is(rules, 'valid', event));
});

test('returns the correct type', (t) => {
  const rules = {
    fun: ['pass field type is complete'],
    notFun: ['pass field type is not complete']
  };

  const funEvent = { name: 'pass', fields: { type: 'complete' } };
  const notFunEvent = { name: 'pass', fields: { type: 'incomplete' } };

  t.is(validator.getType(rules, funEvent), 'fun');
  t.is(validator.getType(rules, notFunEvent), 'not-fun');
});

test('returns the correct maybe type', (t) => {
  const rules = {
    fun: ['pass field type is complete'],
    notFun: ['pass field type is not complete']
  };

  const funEvent = { name: 'pass' };
  const notFunEvent = { name: 'pass' };

  t.deepEqual(validator.getMayBeTypes(rules, funEvent), ['fun', 'not-fun']);
  t.deepEqual(validator.getMayBeTypes(rules, notFunEvent), ['fun', 'not-fun']);
});
