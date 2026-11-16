const mappingMethods = new Set(['map', 'flatMap']);
const freshValueCallees = new Set(['Math.random', 'crypto.randomUUID', 'uuid', 'uuidv4', 'nanoid', 'Date.now']);
const staticSourceCallees = new Set(['Array', 'Array.from']);
const positionPreservingCalls = new Set(['String', 'Number']);

const isNode = (value) => value !== null && typeof value === 'object' && typeof value.type === 'string';

const childNodes = (node) =>
  Object.entries(node)
    .filter(([key]) => key !== 'parent')
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter(isNode);

const descendants = (node) => [node, ...childNodes(node).flatMap(descendants)];

const isPropertyName = (identifier) => {
  const { parent } = identifier;
  const isMemberProperty = parent.type === 'MemberExpression' && parent.property === identifier && !parent.computed;
  const isObjectKey = parent.type === 'Property' && parent.key === identifier && !parent.computed;
  return isMemberProperty || isObjectKey;
};

const referencedNames = (expression) =>
  descendants(expression)
    .filter((node) => node.type === 'Identifier' && !isPropertyName(node))
    .map((identifier) => identifier.name);

const calleeText = (callee) =>
  callee.type === 'MemberExpression' ? `${calleeText(callee.object)}.${callee.property.name}` : callee.name;

const isMappingCallback = (fn) =>
  fn.parent.type === 'CallExpression' &&
  fn.parent.arguments[0] === fn &&
  fn.parent.callee.type === 'MemberExpression' &&
  mappingMethods.has(fn.parent.callee.property.name);

const isStaticSource = (source) =>
  source.type === 'ArrayExpression' ||
  ((source.type === 'CallExpression' || source.type === 'NewExpression') &&
    staticSourceCallees.has(calleeText(source.callee)));

const enclosingMappingCallback = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    const isFunction = /Function/.test(current.type);
    if (isFunction) return isMappingCallback(current) ? current : undefined;
  }
};

const indexParameterName = (callback) => callback.params[1]?.name;

const isPositionOnly = (expression, indexName) => {
  const names = referencedNames(expression);
  return names.includes(indexName) && names.every((name) => name === indexName || positionPreservingCalls.has(name));
};

const isFreshValue = (expression) =>
  expression.type === 'CallExpression' && freshValueCallees.has(calleeText(expression.callee));

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'A list key must be a stable identifier of the item, never its position or a value generated per render.' },
    messages: {
      position: 'This key is the item position. Use a field that identifies the item.',
      generated: 'This key is generated on every render. Use a field that identifies the item.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(attribute) {
        const isKey = attribute.name.name === 'key';
        const expression = attribute.value?.expression;
        if (!isKey || !expression) return;
        if (isFreshValue(expression)) return context.report({ node: attribute, messageId: 'generated' });
        const callback = enclosingMappingCallback(attribute);
        if (!callback || isStaticSource(callback.parent.callee.object)) return;
        if (isPositionOnly(expression, indexParameterName(callback))) context.report({ node: attribute, messageId: 'position' });
      },
    };
  },
};

export const cases = {
  valid: [
    { filename: 'case.tsx', code: 'const list = items.map((item) => <li key={item.id}>{item.name}</li>);' },
    { filename: 'case.tsx', code: 'const list = items.map((item, index) => <li key={`${item.id}-${index}`}>{item.name}</li>);' },
    { filename: 'case.tsx', code: 'const list = [1, 2, 3].map((n, index) => <li key={index}>{n}</li>);' },
    { filename: 'case.tsx', code: 'const list = Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} />);' },
    { filename: 'case.tsx', code: 'const row = <li key={item.id}>{item.name}</li>;' },
  ],
  invalid: [
    { filename: 'case.tsx', code: 'const list = items.map((item, index) => <li key={index}>{item.name}</li>);', errors: 1 },
    { filename: 'case.tsx', code: 'const list = items.map((item, i) => <li key={i}>{item.name}</li>);', errors: 1 },
    { filename: 'case.tsx', code: 'const list = items.map((item, i) => <li key={`row-${i}`}>{item.name}</li>);', errors: 1 },
    { filename: 'case.tsx', code: 'const list = items.map((item) => <li key={Math.random()}>{item.name}</li>);', errors: 1 },
    { filename: 'case.tsx', code: 'const list = items.map((item) => <li key={crypto.randomUUID()}>{item.name}</li>);', errors: 1 },
  ],
};
