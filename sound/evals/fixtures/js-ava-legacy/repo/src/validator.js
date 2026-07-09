import decamelize from 'decamelize';
import memoize from 'memoizee/weak';

import {
  flip,
  equals,
  contains,
  pipe,
  allPass,
  pathOr,
  propEq,
  identity,
  anyPass,
  not,
  map,
  isEmpty,
  prop,
  keys,
  filter,
  curryN,
  partialRight,
  converge,
  nthArg,
  isNil,
  mergeRight,
  any,
  T
} from 'ramda';

import { compile } from './compiler';

function _validate(ast, options = {}) {
  const validateFn = partialRight(_validate, [options]);

  switch (ast.type) {
    case 'rule':
      return allPass([
        ast.name === '*' ? T : propEq('name', ast.name),
        ...(ast.body[0] ? map(validateFn)(ast.body[0]) : [])
      ]);
    case 'feature':
      return anyPass([pipe(prop(ast.name), isEmpty), validateFn(ast.body)]);

    case 'fields':
      return pipe(pathOr('', ['fields', ast.name]), validateFn(ast.body));

    case 'players':
      return pipe(pathOr('', ['players', ast.name]), validateFn(ast.body));

    case 'team':
      return pipe(prop('team'), validateFn(ast.body));

    case 'matcher': {
      const keywordFn = validateFn(ast.keyword);
      const predicate = validateFn(ast.body);

      const matcherFn = pipe(
        keywordFn(predicate),
        ast.negated ? not : identity
      );

      return options.loose ? anyPass([isNil, isEmpty, matcherFn]) : matcherFn;
    }

    case 'keyword':
      return ast.body === 'has' ? any : identity;

    case 'state':
      return ast.body === 'empty' ? isEmpty : identity;

    case 'value':
      return pipe(String, equals(ast.body));

    case 'one of':
      return pipe(String, flip(contains)(ast.body));

    default:
      throw new Error('unknow ast type');
  }
}

const validate = memoize(_validate, {
  length: 2,
  primitive: true,
  normalizer: (...args) => JSON.stringify(args)
});

const validator = converge(validate, [pipe(nthArg(0), compile), nthArg(1)]);
const is = curryN(3, (rules, type, event, validateOptions) => {
  const typeRules = rules[type];
  const validateWithOptions = partialRight(validator, [validateOptions]);
  const compiledRules = map(validateWithOptions, typeRules);

  return anyPass(compiledRules)(event);
});

const decamelizeDashed = partialRight(decamelize, ['-']);
const decamelizeList = map(decamelizeDashed);
const getMayBeTypes = curryN(2, (rules, event, validateOptions) => {
  const rulesType = keys(rules);
  const looseyValidateOptions = mergeRight(validateOptions, { loose: true });
  const validTypes = filter(
    (type) => is(rules, type, event, looseyValidateOptions),
    rulesType
  );

  return decamelizeList(validTypes);
});

const getType = curryN(2, (rules, event, validateOptions) => {
  const rulesType = keys(rules);

  for (const type of rulesType) {
    if (is(rules, type, event, validateOptions)) return decamelizeDashed(type);
  }

  return '';
});

export { getType, getMayBeTypes, validator, is };
