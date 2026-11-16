const functionKinds = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const effectsToExplain = 2;
const componentName = /^[A-Z]/;

const calleeName = (callee) => (callee.type === 'MemberExpression' ? callee.property.name : callee.name);

const isEffectCall = (node) => calleeName(node.callee) === 'useEffect';

const enclosingFunction = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (functionKinds.has(current.type)) return current;
  }
};

const nameOf = (fn) => (fn.id ?? (fn.parent.type === 'VariableDeclarator' ? fn.parent.id : undefined))?.name;

const isComponent = (fn) => componentName.test(nameOf(fn) ?? '');

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Two or more effects in one component each need a named external system, or belong in an event handler.' },
    messages: {
      severalEffects:
        'This component has {{count}} effects. Each must synchronize a different external system and be named, or move into the event handler that causes it.',
    },
    schema: [],
  },
  create(context) {
    const effectsByFunction = new Map();

    return {
      CallExpression(node) {
        if (!isEffectCall(node)) return;
        const owner = enclosingFunction(node);
        if (owner && isComponent(owner)) effectsByFunction.set(owner, [...(effectsByFunction.get(owner) ?? []), node]);
      },
      'Program:exit'() {
        for (const effects of effectsByFunction.values()) {
          if (effects.length >= effectsToExplain) {
            context.report({ node: effects[effectsToExplain - 1], messageId: 'severalEffects', data: { count: effects.length } });
          }
        }
      },
    };
  },
};

export const cases = {
  valid: [
    { filename: 'case.tsx', code: 'function A() { useEffect(() => { document.title = "a"; }, []); return <p />; }' },
    {
      filename: 'case.tsx',
      code: 'function A() { useEffect(() => { document.title = "a"; }, []); return <p />; } function B() { useEffect(() => { document.title = "b"; }, []); return <p />; }',
    },
    { filename: 'case.tsx', code: 'function A() { const [n, setN] = useState(0); const m = useMemo(() => n, [n]); return <p>{m}</p>; }' },
    { filename: 'case.ts', code: 'function useBoth() { useEffect(() => {}, []); useEffect(() => {}, []); }' },
    { filename: 'case.ts', code: 'const useBoth = () => { useEffect(() => {}, []); useEffect(() => {}, []); };' },
  ],
  invalid: [
    {
      filename: 'case.tsx',
      code: 'function A() { useEffect(() => { document.title = "a"; }, []); useEffect(() => { window.scrollTo(0, 0); }, []); return <p />; }',
      errors: 1,
    },
    {
      filename: 'case.tsx',
      code: 'const A = () => { React.useEffect(() => {}, []); React.useEffect(() => {}, []); React.useEffect(() => {}, []); return <p />; };',
      errors: 1,
    },
    {
      filename: 'case.tsx',
      code: 'const A = memoize(function Panel() { useEffect(() => {}, []); useEffect(() => {}, []); return <p />; });',
      errors: 1,
    },
  ],
};
