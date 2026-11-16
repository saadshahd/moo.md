const looseKeywords = new Set(['TSUnknownKeyword', 'TSStringKeyword', 'TSNumberKeyword', 'TSBooleanKeyword']);
const transparentWrappers = new Set(['AwaitExpression', 'ChainExpression', 'TSNonNullExpression', 'TSAsExpression']);
const parsedOnArrival = new Set(['json']);

const testFile = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(test|tests|__tests__)\//;
const looseRecord = /^Record<\s*string\s*,\s*unknown\s*>$/;

const unwrap = (node) => (transparentWrappers.has(node.type) ? unwrap(node.expression ?? node.argument) : node);

const isMember = (node, object, property) =>
  node.type === 'MemberExpression' && node.object.name === object && node.property.name === property;

const isJsonParse = (node) => node.type === 'CallExpression' && isMember(node.callee, 'JSON', 'parse');

const isResponseBody = (node) =>
  node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && parsedOnArrival.has(node.callee.property.name) && node.arguments.length === 0;

const isImportMeta = (node) => node.type === 'MetaProperty' && node.meta.name === 'import' && node.property.name === 'meta';

const isEnvObject = (node) =>
  node.type === 'MemberExpression' && (isMember(node, 'process', 'env') || (isImportMeta(node.object) && node.property.name === 'env'));

const isEnvRead = (node) => node.type === 'MemberExpression' && isEnvObject(node.object);

const isBoundaryValue = (node) => isJsonParse(node) || isResponseBody(node) || isEnvRead(node);

const isDomainCast = (context, node) =>
  !looseKeywords.has(node.typeAnnotation.type) &&
  !(node.typeAnnotation.type === 'TSTypeReference' && node.typeAnnotation.typeName.name === 'const') &&
  !looseRecord.test(context.sourceCode.getText(node.typeAnnotation));

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Data from JSON.parse, a response body or process.env is parsed into its type at the boundary, never asserted.' },
    messages: {
      castOnBoundary: 'This cast trusts data that crossed an untyped boundary. Parse it into the domain type there.',
    },
    schema: [],
  },
  create(context) {
    if (testFile.test(context.filename ?? context.getFilename())) return {};
    return {
      TSAsExpression(node) {
        const isOuterCast = node.parent.type !== 'TSAsExpression';
        if (isOuterCast && isDomainCast(context, node) && isBoundaryValue(unwrap(node.expression))) {
          context.report({ node, messageId: 'castOnBoundary' });
        }
      },
    };
  },
};

export const cases = {
  valid: [
    { code: 'export const a = JSON.parse(raw);' },
    { code: 'export const a = JSON.parse(raw) as unknown;' },
    { code: 'export const a = schema.parse(JSON.parse(raw));' },
    { code: 'export const port = process.env.PORT as string;' },
    { code: 'export const a = value as Order;' },
    { code: 'export const a = { mode: "x" } as const;' },
    { code: 'export const a = (await response.text()) as string;' },
    { code: 'export const a = JSON.parse(raw) as Record<string, unknown>;' },
    { filename: 'read.test.ts', code: 'export const a = JSON.parse(raw) as Order;' },
    { filename: 'src/__tests__/read.ts', code: 'export const a = JSON.parse(raw) as Order;' },
  ],
  invalid: [
    { code: 'export const a = JSON.parse(raw) as Order;', errors: 1 },
    { filename: 'src/read.ts', code: 'export const a = JSON.parse(raw) as Order;', errors: 1 },
    { code: 'export const a = JSON.parse(raw) as Partial<Order>;', errors: 1 },
    { code: 'export const a = (await response.json()) as Order;', errors: 1 },
    { code: 'export const a = process.env.MODE as Mode;', errors: 1 },
    { code: 'export const a = JSON.parse(raw) as any as Order;', errors: 1 },
    { code: 'export const a = import.meta.env.VITE_MODE as Mode;', errors: 1 },
  ],
};
