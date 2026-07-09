const { type } = require('ramda');

const isFn = (fn) => type(fn) === 'Function';

module.exports = {
  isFn
};
