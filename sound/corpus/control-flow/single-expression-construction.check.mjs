const emptyConstructors = new Set(['Map', 'Set', 'WeakMap', 'WeakSet']);
const populatingMethods = new Set(['push', 'unshift', 'add', 'set']);
const loopKinds = new Set(['ForOfStatement', 'ForInStatement', 'ForStatement']);
const notIdentifierCharacters = /[^\w$]+/;

const sourceOf = (context, node) => context.sourceCode.getText(node);

const isEmptyContainer = (node) =>
  (node.type === 'ArrayExpression' && node.elements.length === 0) ||
  (node.type === 'ObjectExpression' && node.properties.length === 0) ||
  (node.type === 'NewExpression' && emptyConstructors.has(node.callee.name) && node.arguments.length === 0);

const declaredEmptyContainer = (statement) => {
  const [declarator] = statement.type === 'VariableDeclaration' ? statement.declarations : [];
  return declarator?.id.type === 'Identifier' && declarator.init && isEmptyContainer(declarator.init) ? declarator.id.name : undefined;
};

const onlyStatement = (node) => (node.type === 'BlockStatement' ? (node.body.length === 1 ? node.body[0] : undefined) : node);

const isMemberOf = (node, name) => node.type === 'MemberExpression' && node.object.name === name;

const valueSide = (statement, name) => {
  if (statement.type === 'IfStatement') {
    const inner = statement.alternate ? undefined : valueSide(onlyStatement(statement.consequent) ?? {}, name);
    return inner && [statement.test, ...inner];
  }
  const expression = statement.type === 'ExpressionStatement' ? statement.expression : undefined;
  if (expression?.type === 'AssignmentExpression' && expression.operator === '=' && isMemberOf(expression.left, name)) {
    return [expression.left.property, expression.right];
  }
  const isPopulatingCall = expression?.type === 'CallExpression' && isMemberOf(expression.callee, name) && populatingMethods.has(expression.callee.property.name);
  return isPopulatingCall ? expression.arguments : undefined;
};

const bodyStatements = (node) => (node.type === 'BlockStatement' ? node.body : [node]);

const forEachBody = (statement) => {
  const call = statement.type === 'ExpressionStatement' ? statement.expression : undefined;
  const callback = call?.type === 'CallExpression' && call.callee.type === 'MemberExpression' && call.callee.property.name === 'forEach' ? call.arguments[0] : undefined;
  return callback && /Function/.test(callback.type) && callback.body.type === 'BlockStatement' ? callback.body.body : undefined;
};

const loopBody = (statement) => (loopKinds.has(statement.type) && !statement.await ? bodyStatements(statement.body) : forEachBody(statement));

const mentionsAny = (context, nodes, words) =>
  nodes.some((node) => sourceOf(context, node).split(notIdentifierCharacters).some((word) => words.includes(word)));

const fillsOnly = (context, body, name) => {
  const sides = (body ?? []).map((statement) => valueSide(statement, name));
  return sides.length > 0 && sides.every(Boolean) && !mentionsAny(context, sides.flat(), [name, 'await']);
};

const checkBlock = (context, statements) => {
  statements.forEach((statement, index) => {
    const name = declaredEmptyContainer(statement);
    const next = statements[index + 1];
    if (name && next && fillsOnly(context, loopBody(next), name)) {
      context.report({ node: statement, messageId: 'buildInOneExpression', data: { name } });
    }
  });
};

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Derived data is built as one expression, not an empty container filled by a loop.' },
    messages: {
      buildInOneExpression: '{{name}} starts empty and a loop only fills it. Build it as one expression: a chained transformation or one constructor over a mapped source.',
    },
    schema: [],
  },
  create: (context) => ({
    BlockStatement: (node) => checkBlock(context, node.body),
    Program: (node) => checkBlock(context, node.body),
  }),
};

export const cases = {
  valid: [
    { code: 'export const f = (xs) => xs.map((x) => x + 1);' },
    { code: 'export const f = (xs) => { const out = []; for (const x of xs) { console.log(x); out.push(x); } return out; };' },
    { code: 'export const f = (xs) => { const out = []; for (const x of xs) { if (x.done) break; out.push(x); } return out; };' },
    { code: 'export const f = (xs) => { const out = []; return xs.length ? out : []; };' },
    { code: 'export const f = (xs) => { const out = [1]; for (const x of xs) { out.push(x); } return out; };' },
    { code: 'export const f = (xs) => { const out = []; for (const x of xs) { if (x.a) { out.push(x); } else { out.push(0); } } return out; };' },
    { code: 'export const f = (xs) => { const counts = new Map(); for (const x of xs) { counts.set(x.kind, (counts.get(x.kind) ?? 0) + 1); } return counts; };' },
    { code: 'export const f = (xs) => { const out = []; for (const x of xs) { if (!out.includes(x)) out.push(x); } return out; };' },
    { code: 'export const f = (xs) => { let total = {}; for (const x of xs) { total[x.id] += x.n; } return total; };' },
    { code: 'export const f = async (xs) => { const out = []; for (const x of xs) { out.push(await run(x)); } return out; };' },
    { code: 'export const f = async (stream) => { const chunks = []; for await (const chunk of stream) { chunks.push(chunk); } return chunks; };' },
  ],
  invalid: [
    { code: 'export const f = (xs) => { const out = []; for (const x of xs) { out.push(x + 1); } return out; };', errors: 1 },
    { code: 'export const f = (xs) => { const index = new Map(); for (const x of xs) { index.set(x.id, x); } return index; };', errors: 1 },
    { code: 'export const f = (xs) => { const out = {}; for (const x of xs) { out[x.id] = x; } return out; };', errors: 1 },
    { code: 'export const f = (xs) => { const out = []; for (const x of xs) { if (x.ok) { out.push(x); } } return out; };', errors: 1 },
    { code: 'export const f = (xs) => { const seen = new Set(); xs.forEach((x) => { seen.add(x); }); return seen; };', errors: 1 },
    { code: 'export const f = (n) => { const out = []; for (let i = 0; i < n; i++) { out.push(i * 2); } return out; };', errors: 1 },
  ],
};
