const looseKeys = new Set(['TSStringKeyword', 'TSNumberKeyword', 'TSSymbolKeyword', 'TSAnyKeyword']);

const typeArgumentsOf = (reference) => (reference.typeArguments ?? reference.typeParameters)?.params ?? [];

const isRecordOfClosedKeys = (annotation) => {
  const reference = annotation?.typeAnnotation;
  if (reference?.type !== 'TSTypeReference' || reference.typeName.name !== 'Record') return false;
  const [keys] = typeArgumentsOf(reference);
  return keys !== undefined && !looseKeys.has(keys.type);
};

const isHandWrittenTable = (init) => init?.type === 'ObjectExpression' && init.properties.length > 0 && init.properties.every((property) => property.type === 'Property');

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'A hand-written table keyed by a union is written as const satisfies the Record, not annotated.' },
    messages: {
      annotatedTable: '{{name}} is a literal table annotated with Record. Write the literal as const satisfies Record<…> so its values keep their literal types.',
    },
    schema: [],
  },
  create: (context) => ({
    VariableDeclarator(node) {
      if (node.id.type === 'Identifier' && isRecordOfClosedKeys(node.id.typeAnnotation) && isHandWrittenTable(node.init)) {
        context.report({ node, messageId: 'annotatedTable', data: { name: node.id.name } });
      }
    },
  }),
};

export const cases = {
  valid: [
    { code: 'export const labels = { a: "A", b: "B" } as const satisfies Record<Tab, string>;' },
    { code: 'export const counts: Record<string, number> = { a: 1 };' },
    { code: 'export const labels: Record<Tab, string> = build();' },
    { code: 'export const labels: Record<Tab, string> = { ...base, a: "A" };' },
    { code: 'export const labels: Record<Tab, string> = {};' },
    { code: 'export const point: Point = { x: 1, y: 2 };' },
    { code: 'export const labels = { a: "A" };' },
  ],
  invalid: [
    { code: 'export const labels: Record<Tab, string> = { a: "A", b: "B" };', errors: 1 },
    { code: 'const labels: Record<"a" | "b", number> = { a: 1, b: 2 };', errors: 1 },
    { code: 'export const order: Record<Status, number> = { open: 0, closed: 1 };', errors: 1 },
  ],
};
