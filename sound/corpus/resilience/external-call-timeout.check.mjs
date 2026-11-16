const testFile = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(test|tests|__tests__)\//;
const deadlineOptions = new Set(['signal', 'timeout']);

const hasSpread = (options) => options.properties.some((property) => property.type === 'SpreadElement');

const namesDeadline = (options) => options.properties.some((property) => !property.computed && deadlineOptions.has(property.key?.name));

const isCarriedByArgument = (target) => target.type === 'NewExpression' || target.type === 'CallExpression';

const lacksDeadline = (node) => {
  const [target, options] = node.arguments;
  if (!target || isCarriedByArgument(target)) return false;
  if (!options) return true;
  return options.type === 'ObjectExpression' && !hasSpread(options) && !namesDeadline(options);
};

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'A fetch call carries a deadline: a signal or a timeout.' },
    messages: {
      noDeadline: 'This fetch has no signal or timeout, so a stalled server stalls the caller. Pass signal: AbortSignal.timeout(ms).',
    },
    schema: [],
  },
  create(context) {
    if (testFile.test(context.filename ?? context.getFilename())) return {};
    return {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'fetch' && lacksDeadline(node)) {
          context.report({ node, messageId: 'noDeadline' });
        }
      },
    };
  },
};

export const cases = {
  valid: [
    { code: 'export const a = fetch(url, { signal: AbortSignal.timeout(5000) });' },
    { code: 'export const a = fetch(url, { method: "POST", signal });' },
    { code: 'export const a = fetch(url, { ...init });' },
    { code: 'export const a = fetch(url, options);' },
    { code: 'export const a = fetch(new Request(url, { signal }));' },
    { code: 'export const a = fetchWithTimeout(url);' },
    { code: 'export const a = client.fetch(url);' },
    { filename: 'src/read.test.ts', code: 'export const a = fetch(url);' },
  ],
  invalid: [
    { code: 'export const a = fetch(url);', errors: 1 },
    { code: 'export const a = await fetch("/api");', errors: 1 },
    { code: 'export const a = fetch(url, { method: "POST" });', errors: 1 },
    { code: 'export const a = fetch(`${base}/x`, { headers });', errors: 1 },
    { filename: 'src/read.ts', code: 'export const a = fetch(url);', errors: 1 },
  ],
};
