const minimumArms = 3;
const valueExpressions = new Set(['Literal', 'TemplateLiteral', 'Identifier', 'MemberExpression', 'ObjectExpression', 'ArrayExpression', 'UnaryExpression', 'BinaryExpression']);
const notIdentifierCharacters = /[^\w$]+/;

const sourceOf = (context, node) => context.sourceCode.getText(node);

const isLiteral = (node) => node.type === 'Literal';

const unblocked = (statements) => statements.flatMap((statement) => (statement.type === 'BlockStatement' ? statement.body : [statement]));

const returnedValue = (statements) => {
  const [statement, ...rest] = unblocked(statements);
  return rest.length === 0 && statement?.type === 'ReturnStatement' && valueExpressions.has(statement.argument?.type) ? statement.argument : undefined;
};

const rootName = (node) => {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'ThisExpression') return 'this';
  return node.type === 'MemberExpression' ? rootName(node.object) : undefined;
};

const readsKey = (context, key, value) => {
  const root = rootName(key);
  return root !== undefined && sourceOf(context, value).split(notIdentifierCharacters).includes(root);
};

const isLookup = (context, { key, results }) =>
  results.length >= minimumArms && results.every((value) => value !== undefined && !readsKey(context, key, value));

const keyOf = (test) => {
  const isEquality = test.type === 'BinaryExpression' && (test.operator === '===' || test.operator === '==');
  if (!isEquality) return undefined;
  if (isLiteral(test.right)) return test.left;
  return isLiteral(test.left) ? test.right : undefined;
};

const chainBranches = (node) => (node.type === 'IfStatement' ? [node, ...(node.alternate ? chainBranches(node.alternate) : [])] : []);

const isLookupChain = (context, node) => {
  const branches = chainBranches(node);
  const [first, ...others] = branches.map((branch) => keyOf(branch.test));
  const sameKey = first !== undefined && others.every((key) => key !== undefined && sourceOf(context, key) === sourceOf(context, first));
  return sameKey && isLookup(context, { key: first, results: branches.map((branch) => returnedValue([branch.consequent])) });
};

const isLookupSwitch = (context, node) => {
  const arms = node.cases.filter((arm) => arm.test !== null);
  return arms.every((arm) => isLiteral(arm.test)) && isLookup(context, { key: node.discriminant, results: arms.map((arm) => returnedValue(arm.consequent)) });
};

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'A switch or else-if chain that only maps literal keys to returned values is an object or Map lookup.' },
    messages: {
      useLookup: 'Every arm compares one value to a literal and returns a result. Replace this with an object or Map lookup.',
    },
    schema: [],
  },
  create: (context) => ({
    SwitchStatement(node) {
      if (isLookupSwitch(context, node)) context.report({ node, messageId: 'useLookup' });
    },
    IfStatement(node) {
      const startsChain = node.parent.type !== 'IfStatement' || node.parent.alternate !== node;
      if (startsChain && isLookupChain(context, node)) context.report({ node, messageId: 'useLookup' });
    },
  }),
};

export const cases = {
  valid: [
    { code: 'export const f = (k) => { switch (k) { case "a": return 1; case "b": return 2; } return 0; };' },
    { code: 'export const f = (k) => { switch (k) { case "a": return make(1); case "b": return make(2); case "c": return make(3); } return 0; };' },
    { code: 'export const f = (k) => { switch (k) { case "a": return new A(); case "b": return new B(); case "c": return new C(); } return 0; };' },
    { filename: 'case.tsx', code: 'export const f = (k) => { switch (k) { case "a": return <A />; case "b": return <B />; case "c": return <C />; } return null; };' },
    { code: 'export const f = (k) => { switch (k) { case "a": run(); break; case "b": stop(); break; case "c": pause(); break; } };' },
    { code: 'export const f = (k) => { switch (k) { case "a": case "b": return 1; case "c": return 2; case "d": return 3; } return 0; };' },
    { code: 'export const f = (k, other) => { switch (k) { case other: return 1; case "b": return 2; case "c": return 3; } return 0; };' },
    { code: 'export const f = (outcome) => { switch (outcome.kind) { case "a": return { until: outcome.until }; case "b": return { why: outcome.card }; case "c": return { lost: true }; } };' },
    { code: 'export const f = (a, b) => { if (a === "x") return 1; else if (b === "y") return 2; else if (a === "z") return 3; return 0; };' },
    { code: 'export const f = (k) => { if (k === "a") { run(); return 1; } else if (k === "b") return 2; else if (k === "c") return 3; return 0; };' },
    { code: 'export const f = (k) => { if (k > 1) return 1; else if (k > 2) return 2; else if (k > 3) return 3; return 0; };' },
    { code: 'export const f = (k) => { if (k === 1) { return "x"; } else if (k === 2) { return "y"; } else { if (k === 3) { return "z"; } } return ""; };' },
  ],
  invalid: [
    { code: 'export const f = (k) => { switch (k) { case "a": return 1; case "b": return 2; case "c": return 3; default: return 0; } };', errors: 1 },
    { code: 'export const f = (k) => { switch (k.kind) { case "a": { return 1; } case "b": { return 2; } case "c": { return 3; } } return 0; };', errors: 1 },
    { code: 'export const f = (k) => { if (k === "a") return 1; else if (k === "b") return 2; else if (k === "c") return 3; return 0; };', errors: 1 },
    { code: 'export const f = (k) => { if ("a" === k) { return 1; } else if (k === "b") { return 2; } else if (k === "c") { return 3; } return 0; };', errors: 1 },
    { code: 'export const f = (k) => { switch (k) { case "a": return { ok: true, label: "A" }; case "b": return { ok: true, label: "B" }; case "c": return { ok: false, label: "C" }; } };', errors: 1 },
  ],
};
