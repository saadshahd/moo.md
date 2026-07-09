import ohm from 'ohm-js';
import grammarStr from './grammar.ohm';

const grammar = ohm.grammar(grammarStr);
const semantics = grammar.createSemantics();

semantics.addOperation('interprate', {
  rule(name, _, body) {
    return {
      type: 'rule',
      name: name.interprate(),
      body: body.interprate()
    };
  },

  feature(body, _) {
    return {
      type: 'feature',
      name: body.ctorName,
      body: body.interprate()
    };
  },

  fields(_, __, name, body) {
    return {
      type: 'fields',
      name: name.interprate(),
      body: body.interprate()
    };
  },

  players(_, __, name, body) {
    return {
      type: 'players',
      name: name.interprate(),
      body: body.interprate()
    };
  },

  team(_, __, ___, body) {
    return {
      type: 'team',
      body: body.interprate()
    };
  },

  matcher(_keyword, body) {
    const keyword = _keyword.interprate();
    const { negated } = keyword;

    return {
      keyword,
      negated,
      type: 'matcher',
      body: body.interprate()
    };
  },

  condition(many, body) {
    return {
      type: many.interprate().trim() || body.ctorName,
      body: body.interprate()
    };
  },

  keyword(name, not, verb) {
    const interpratedName = name.interprate().trim();
    const interpratedVerb = verb.interprate().trim();
    let finalName = interpratedName;

    if (interpratedName === 'does' && interpratedVerb === 'have') {
      finalName = 'has';
    }

    return {
      type: 'keyword',
      body: finalName,
      negated: Boolean(not.sourceString)
    };
  },

  state(name, _) {
    return name.interprate();
  },

  chars(char) {
    return char.interprate().join('');
  },

  char(v) {
    return v.sourceString;
  },

  nonemptyListOf(first, seperator, rest) {
    return [first.interprate(), ...rest.interprate()];
  },

  _terminal() {
    return this.primitiveValue;
  }
});

const compiledCache = {};
const compile = (rule) => {
  if (compiledCache[rule]) return compiledCache[rule];

  const parsed = grammar.match(rule);
  const interprated = semantics(parsed).interprate();

  compiledCache[rule] = interprated;

  return interprated;
};

export { compile, grammar, semantics };
