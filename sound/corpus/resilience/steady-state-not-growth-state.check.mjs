const oneShotPath = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(test|tests|__tests__|fixtures|scripts?|tools?|bin|evals?)\//;
const boundWords = /\b(expir\w*|ttl|evict\w*|lru|maxSize|maxEntries|capacity)\b/i;
const functionKinds = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const growingMethods = new Set(['set', 'add', 'push', 'unshift']);
const shrinkingMethods = new Set(['delete', 'clear', 'shift', 'pop', 'splice']);
const emptyConstructors = new Set(['Map', 'Set']);

const isEmptyContainer = (node) =>
  node?.type === 'ArrayExpression' ? node.elements.length === 0 : node?.type === 'NewExpression' && emptyConstructors.has(node.callee.name) && node.arguments.length === 0;

const isInsideFunction = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (functionKinds.has(current.type)) return true;
  }
  return false;
};

const isModuleScope = (declarator) => {
  const declaration = declarator.parent;
  const container = declaration.parent;
  return container.type === 'Program' || (container.type === 'ExportNamedDeclaration' && container.parent.type === 'Program');
};

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'A module-level collection that only grows has a size cap, an expiry or an eviction path.' },
    messages: {
      growsWithoutBound: '{{name}} is a module-level collection that functions add to and nothing removes from. Cap it, expire entries, or evict.',
    },
    schema: [],
  },
  create(context) {
    if (oneShotPath.test(context.filename ?? context.getFilename()) || boundWords.test(context.sourceCode.getText())) return {};
    const collections = new Map();
    const growing = new Set();
    const shrinking = new Set();
    return {
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isEmptyContainer(node.init) && isModuleScope(node)) collections.set(node.id.name, node);
      },
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'MemberExpression' || callee.object.type !== 'Identifier') return;
        if (growingMethods.has(callee.property.name) && isInsideFunction(node)) growing.add(callee.object.name);
        if (shrinkingMethods.has(callee.property.name)) shrinking.add(callee.object.name);
      },
      UnaryExpression(node) {
        if (node.operator === 'delete' && node.argument.type === 'MemberExpression' && node.argument.object.type === 'Identifier') shrinking.add(node.argument.object.name);
      },
      AssignmentExpression(node) {
        const { left } = node;
        if (left.type === 'MemberExpression' && left.object.type === 'Identifier' && left.property.name === 'length') shrinking.add(left.object.name);
      },
      'Program:exit'() {
        for (const [name, declarator] of collections) {
          if (growing.has(name) && !shrinking.has(name)) context.report({ node: declarator, messageId: 'growsWithoutBound', data: { name } });
        }
      },
    };
  },
};

export const cases = {
  valid: [
    { code: 'const seen = new Set(); export const mark = (id) => { seen.add(id); if (seen.size > 100) seen.clear(); };' },
    { code: 'const queue = []; export const put = (x) => { queue.push(x); }; export const take = () => queue.shift();' },
    { code: 'const cache = new Map(); export const put = (k, v) => { cache.set(k, v); cache.delete(old); };' },
    { code: 'const registry = []; registry.push(first); registry.push(second);' },
    { code: 'export const f = () => { const local = []; local.push(1); return local; };' },
    { code: 'const buffer = []; export const add = (x) => { buffer.push(x); }; export const reset = () => { buffer.length = 0; };' },
    { code: 'const items = [1, 2]; export const add = (x) => { items.push(x); };' },
    { code: 'const cache = new Map(); export const put = (k, v) => { cache.set(k, { v, expiresAt: Date.now() + ttl }); };' },
    { filename: 'scripts/build.ts', code: 'const seen = new Set(); export const mark = (id) => { seen.add(id); };' },
    { filename: 'src/read.test.ts', code: 'const seen = new Set(); export const mark = (id) => { seen.add(id); };' },
  ],
  invalid: [
    { code: 'const seen = new Set(); export const mark = (id) => { seen.add(id); };', errors: 1 },
    { code: 'const log = []; export function record(line) { log.push(line); }', errors: 1 },
    { code: 'export const cache = new Map(); export const put = (k, v) => { cache.set(k, v); };', errors: 1 },
    { code: 'const hits = []; export const track = (x) => () => { hits.unshift(x); };', errors: 1 },
  ],
};
