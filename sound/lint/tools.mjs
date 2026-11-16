import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const sourceGlob = '**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}';
const reportExcerptLength = 300;
const oxlintCode = /^(.+)\((.+)\)$/;
const eslintSeverities = { 1: 'warn', 2: 'error' };
const oxlintSeverities = { warning: 'warn', error: 'error', advice: 'warn' };

const eslintHits = (stdout) =>
  JSON.parse(stdout).flatMap(({ filePath, messages }) =>
    messages.map(({ ruleId, severity, message, line, column, fatal }) => ({
      file: filePath,
      ruleId: fatal ? null : ruleId,
      severity: fatal ? 'fatal' : eslintSeverities[severity],
      message,
      line,
      column,
    })),
  );

const oxlintRuleId = (code) => (oxlintCode.test(code) ? code.replace(oxlintCode, '$1/$2') : code);

const oxlintHits = (stdout) =>
  JSON.parse(stdout.slice(stdout.indexOf('{'))).diagnostics.map(({ message, code, severity, filename, labels }) => ({
    file: filename ?? '',
    ruleId: code ? oxlintRuleId(code) : null,
    severity: code ? oxlintSeverities[severity] : 'fatal',
    message,
    line: labels[0]?.span.line,
    column: labels[0]?.span.column,
  }));

const parserImport = (parserPath) =>
  parserPath ? `import parser from ${JSON.stringify(parserPath)};` : 'const parser = undefined;';

const ruleEntries = (rules) => Object.fromEntries(rules.map((rule) => [`sound/${rule}`, 'error']));

export const tools = {
  eslint: {
    floor: '8.57.1',
    scanConfigFile: 'eslint.config.mjs',
    env: { ESLINT_USE_FLAT_CONFIG: 'true' },
    args: ({ config, files }) => [
      '--format',
      'json',
      '--no-error-on-unmatched-pattern',
      ...(config ? ['-c', config] : []),
      ...files,
    ],
    hits: eslintHits,
    scanConfig: ({ pluginPath, parserPath, rules }) => `${parserImport(parserPath)}
import sound from ${JSON.stringify(pluginPath)};
export default [{
  files: [${JSON.stringify(sourceGlob)}],
  languageOptions: { ...(parser && { parser }), parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { sound },
  rules: ${JSON.stringify(ruleEntries(rules))},
}];
`,
  },
  oxlint: {
    floor: '1.26.0',
    scanConfigFile: '.oxlintrc.json',
    env: {},
    args: ({ config, files }) => ['--format', 'json', ...(config ? ['-c', config] : []), ...files],
    hits: oxlintHits,
    scanConfig: ({ pluginPath, rules }) =>
      JSON.stringify({ jsPlugins: [pluginPath], rules: ruleEntries(rules) }, null, 2),
  },
};

export const meetsFloor = ({ tool, version }) => version.localeCompare(tools[tool].floor, 'en', { numeric: true }) >= 0;

const readReport = ({ tool, adapter, run }) => {
  try {
    return adapter.hits(run.stdout);
  } catch (error) {
    const printed = (run.stderr + run.stdout).trim().slice(0, reportExcerptLength) || 'nothing';
    throw new Error(`${tool} exited ${run.status} with a report that cannot be read (${error.message}); it printed: ${printed}`);
  }
};

export const runLint = ({ tool, bin, cwd, config, files }) => {
  const adapter = tools[tool];
  const run = spawnSync(bin, adapter.args({ config, files }), {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: { ...process.env, ...adapter.env },
  });
  if (run.error) throw new Error(`${tool} could not start: ${run.error.message}`);
  const lintedCleanOrFoundHits = run.status === 0 || run.status === 1;
  if (!lintedCleanOrFoundHits) throw new Error(`${tool} exited ${run.status}: ${run.stderr || run.stdout}`);
  const root = realpathSync(cwd);
  const relativeToRoot = (hit) =>
    hit.file ? { ...hit, file: relative(root, realpathSync(resolve(cwd, hit.file))) } : hit;
  return { hits: readReport({ tool, adapter, run }).map(relativeToRoot), exitCode: run.status };
};
