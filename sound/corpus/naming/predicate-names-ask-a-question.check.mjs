const hidesTheQuestion = /^(validate|check)(?![a-z])/;

const nameOf = (fn) => {
  const { parent } = fn;
  if (fn.id) return fn.id.name;
  if (parent.type === 'VariableDeclarator') return parent.id.name;
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && !parent.computed) return parent.key.name;
  return undefined;
};

const declaresBoolean = (fn) => fn.returnType?.typeAnnotation.type === 'TSBooleanKeyword';

const check = (context) => (fn) => {
  const name = nameOf(fn);
  if (name && declaresBoolean(fn) && hidesTheQuestion.test(name)) {
    context.report({ node: fn, messageId: 'hidesTheQuestion', data: { name } });
  }
};

export default {
  meta: {
    type: 'problem',
    docs: { description: 'A function named validate or check that returns boolean is named for the yes/no question it answers.' },
    messages: {
      hidesTheQuestion: '{{name}} returns boolean, and validate/check hide the question. Name it for the question: is…, was…, should…, does… or has….',
    },
    schema: [],
  },
  create: (context) => {
    const inspect = check(context);
    return { FunctionDeclaration: inspect, FunctionExpression: inspect, ArrowFunctionExpression: inspect, TSDeclareFunction: inspect };
  },
};

export const cases = {
  valid: [
    { code: 'export function isReady(): boolean { return true; }' },
    { code: 'export const hasItems = (xs: string[]): boolean => xs.length > 0;' },
    { code: 'export function wasRetried(): boolean { return false; }' },
    { code: 'export function build(): string { return ""; }' },
    { code: 'export function validate(raw: string): Result { return parse(raw); }' },
    { code: 'export function validate(raw: string) { return raw.length > 0; }' },
    { code: 'export const keep = (xs: Item[]) => xs.filter((x): boolean => x.ok);' },
    { code: 'export function checkout(cart: Cart): boolean { return true; }' },
    { code: 'export function matchesPeer(peer: Peer): boolean { return true; }' },
  ],
  invalid: [
    { code: 'export function validate(raw: string): boolean { return raw.length > 0; }', errors: 1 },
    { code: 'export const check = (raw: string): boolean => raw.length > 0;', errors: 1 },
    { code: 'export class Door { checkOpen(): boolean { return true; } }', errors: 1 },
    { code: 'export function validateOptions(opts: Options): boolean { return true; }', errors: 1 },
    { code: 'export const api = { validateInput: (): boolean => true };', errors: 1 },
  ],
};
