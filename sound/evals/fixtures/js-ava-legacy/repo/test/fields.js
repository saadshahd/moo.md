const test = require('ava');
const { isFn } = require('../helpers');
const { fields } = require('..');

test('returns fields object with expected methods', (t) => {
  t.truthy(fields);

  t.truthy(fields.tester);
  t.truthy(isFn(fields.tester));

  t.truthy(fields.isIncluded);
  t.truthy(isFn(fields.isIncluded));

  t.truthy(fields.isValidField);
  t.truthy(isFn(fields.isValidField));

  t.truthy(fields.isValidOption);
  t.truthy(isFn(fields.isValidOption));

  t.truthy(fields.isCheckbox);
  t.truthy(isFn(fields.isCheckbox));

  t.truthy(fields.isTimestamp);
  t.truthy(isFn(fields.isTimestamp));
});

test('returns false when field is empty', (t) => {
  const item = {
    include: {
      type: ['open-play']
    }
  };

  t.false(fields.tester(item, 'include', {}));
});

test('returns true when field matches include prop', (t) => {
  const item = {
    include: {
      type: ['open-play'],
      height: ['low']
    }
  };

  t.truthy(
    fields.tester(item, 'include', {
      type: 'open-play',
      height: 'low'
    })
  );
});

test('returns false when field not-matches include prop', (t) => {
  const item = {
    include: {
      type: ['open-play'],
      height: ['low']
    }
  };

  t.falsy(
    fields.tester(item, 'include', {
      type: 'kick-off',
      height: 'ground'
    })
  );
});

test('returns true when field matches anded include prop', (t) => {
  const item = {
    include: {
      type: ['open-play'],
      height: ['low'],
      anded: true
    }
  };

  t.truthy(
    fields.tester(item, 'include', {
      type: 'open-play',
      height: 'low'
    })
  );
});

test('returns false when field not-matches anded include prop', (t) => {
  const item = {
    include: {
      type: ['open-play'],
      height: ['low'],
      anded: true
    }
  };

  t.falsy(
    fields.tester(item, 'include', {
      type: 'open-play',
      height: 'ground'
    })
  );
});

// Exclude
test('returns true when field matches exclude prop', (t) => {
  const item = {
    exclude: {
      type: ['open-play'],
      height: ['low']
    }
  };

  t.truthy(
    fields.tester(item, 'exclude', {
      type: 'open-play',
      height: 'high'
    })
  );
});

test('returns false when field not-matches exclude prop', (t) => {
  const item = {
    exclude: {
      type: ['open-play'],
      height: ['low']
    }
  };

  t.falsy(
    fields.tester(item, 'exclude', {
      type: 'kick-off',
      height: 'ground'
    })
  );
});

test('returns true when field matches anded exclude prop', (t) => {
  const item = {
    exclude: {
      type: ['open-play'],
      height: ['low'],
      anded: true
    }
  };

  t.truthy(
    fields.tester(item, 'exclude', {
      type: 'open-play',
      height: 'low'
    })
  );
// [trimmed]
