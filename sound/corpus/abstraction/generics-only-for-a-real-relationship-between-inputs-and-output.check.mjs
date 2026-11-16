const signatureKinds = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
  'TSMethodSignature',
  'TSFunctionType',
  'TSCallSignatureDeclaration',
  'TSConstructSignatureDeclaration',
];

const signatureRange = (fn) => ({
  start: fn.range[0],
  end: fn.body ? fn.body.range[0] : fn.range[1],
});

const isWithin = (range) => (reference) =>
  reference.identifier.range[0] >= range.start && reference.identifier.range[1] <= range.end;

const hasDeclaredReturnType = (fn) => Boolean(fn.returnType);

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'A type parameter must link two or more positions of the signature.' },
    messages: {
      linksNothing:
        'Type parameter {{name}} appears {{count}} time(s) in the signature. Use the concrete type or delete it, never unknown on an input.',
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;

    const checkSignature = (fn) => {
      if (!hasDeclaredReturnType(fn)) return;
      const range = signatureRange(fn);
      for (const typeParameter of fn.typeParameters?.params ?? []) {
        const [variable] = sourceCode.getDeclaredVariables(typeParameter);
        const count = variable.references.filter(isWithin(range)).length;
        if (count < 2) {
          context.report({ node: typeParameter, messageId: 'linksNothing', data: { name: typeParameter.name.name, count } });
        }
      }
    };

    return Object.fromEntries(signatureKinds.map((kind) => [kind, checkSignature]));
  },
};

export const cases = {
  valid: [
    { code: 'function pair<T>(a: T, b: T): T { return a; }' },
    { code: 'function first<T>(items: T[]): T | undefined { return items[0]; }' },
    { code: 'function pick<O, K extends keyof O>(o: O, k: K): O[K] { return o[k]; }' },
    { code: 'function identity<T>(x: T) { return x; }' },
    { code: 'const identity = <T,>(x: T) => x;' },
    { code: 'class Box<T> { get(): T { return this.value; } constructor(private value: T) {} }' },
    { code: 'function render(x: string): void {}' },
  ],
  invalid: [
    { code: 'function log<T>(x: T): void {}', errors: 1 },
    { code: 'async function get<T>(url: string): Promise<T> { return fetch(url) as Promise<T>; }', errors: 1 },
    { code: 'function size<T extends string>(x: T): number { return x.length; }', errors: 1 },
    { code: 'function first<A, B>(a: A, b: B): A { return a; }', errors: 1 },
    { code: 'function none<T>(): void {}', errors: 1 },
    { code: 'interface Sink { write<T>(x: T): void }', errors: 1 },
    { code: 'const log = <T,>(x: T): void => {};', errors: 1 },
  ],
};
