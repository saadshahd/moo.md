import { relative, sep } from 'node:path';

const unshippedFolders = new Set(['test', 'tests', '__tests__', '__mocks__', 'spec', 'e2e', 'scripts', 'bench', 'benchmarks', 'examples', 'demo', 'demos', 'evals', 'fixtures', 'stories']);
const unshippedFile = /(?:^|[.-])(?:test|spec|bench|demo|stories|config)[.-]/;

const isShipped = (path) => {
  const segments = path.split(sep);
  const file = segments.pop();
  return !segments.some((segment) => unshippedFolders.has(segment)) && !unshippedFile.test(file);
};

const isConsoleCall = (callee) =>
  callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && callee.object.name === 'console';

const methodName = (member) => (member.computed ? String(member.property.value) : member.property.name);

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Shipped code logs a diagnostic through a structured logger carrying an id, never console.' },
    messages: {
      consoleCall:
        'console.{{method}} in shipped code: log a diagnostic through a structured logger carrying an id, and write a CLI result to process.stdout.',
    },
    schema: [],
  },
  create(context) {
    if (!isShipped(relative(context.cwd, context.filename))) return {};
    return {
      CallExpression(node) {
        if (isConsoleCall(node.callee)) context.report({ node, messageId: 'consoleCall', data: { method: methodName(node.callee) } });
      },
    };
  },
};

export const cases = {
  valid: [
    { code: 'logger.info({ orderId }, "order saved");' },
    { code: 'process.stdout.write(JSON.stringify(result) + "\\n");' },
    { code: 'const log = createLogger("billing"); log.error({ invoiceId, error }, "charge failed");' },
    { code: 'terminal.console.log("x");' },
  ],
  invalid: [
    { code: 'console.log("saved", order);', errors: 1 },
    { code: 'function charge(invoice) { try { return pay(invoice); } catch (error) { console.error(error); throw error; } }', errors: 1 },
    { code: 'console.warn("slow"); console.table(rows);', errors: 2 },
    { code: 'console["debug"]("raw");', errors: 1 },
    { filename: 'src/cli/main.ts', code: 'console.log(render(report));', errors: 1 },
  ],
};
