import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

const skippedSegments = new Set(['node_modules', '.git', 'worktrees', 'dist', 'build']);
const flatConfig = /(?:^|\/)eslint\.config\.[cm]?[jt]s$/;
const legacyConfig = /(?:^|\/)\.eslintrc(?:\.(?:json|js|cjs|yaml|yml))?$/;
const oxlintConfig = /(?:^|\/)\.oxlintrc\.json$/;
const biomeConfig = /(?:^|\/)biome\.jsonc?$/;
const lintCommands = [
  { tool: 'oxlint', pattern: /\boxlint\b/ },
  { tool: 'eslint', pattern: /\beslint\b/ },
  { tool: 'biome', pattern: /\bbiome\b/ },
  { tool: 'xo', pattern: /\bxo\b/ },
  { tool: 'next-lint', pattern: /\bnext lint\b/ },
];
const huskyHooks = /(?:^|\/)\.husky\/pre-commit$/;
const lockedVersionIn = {
  'package-lock.json': ({ tool, text }) => {
    const lock = JSON.parse(text);
    return (lock.packages?.[`node_modules/${tool}`] ?? lock.dependencies?.[tool])?.version;
  },
  'pnpm-lock.yaml': ({ tool, text }) => text.match(new RegExp(`(?:^|[\\s/'"])${tool}@(\\d+\\.\\d+\\.\\d+)`, 'm'))?.[1],
  'yarn.lock': ({ tool, text }) => text.match(new RegExp(`^"?${tool}@[^\\n]*:\\n\\s+version:? "?(\\d+\\.\\d+\\.\\d+)`, 'm'))?.[1],
  'bun.lock': ({ tool, text }) => text.match(new RegExp(`"${tool}@(\\d+\\.\\d+\\.\\d+)"`))?.[1],
};

const depth = (path) => path.split('/').length;
const directoryOf = (path) => (path.includes('/') ? posix.dirname(path) : '');

const ownFiles = (files) =>
  files.filter((path) => !path.split('/').some((segment) => skippedSegments.has(segment)));

const parsedManifest = (read) => {
  const text = read('package.json');
  return text === undefined ? {} : JSON.parse(text);
};

const lintScriptOf = (manifest) => {
  const scripts = Object.entries(manifest.scripts ?? {}).flatMap(([name, command]) =>
    lintCommands.filter(({ pattern }) => pattern.test(command)).map(({ tool }) => ({ name, tool, command })),
  );
  return scripts.find(({ name }) => name === 'lint') ?? scripts[0] ?? null;
};

const hookOf = ({ files, manifest, hooksPath }) => {
  const named = (manager, file) => ({ manager, file });
  const present = (name) => files.find((path) => path === name);
  if (present('lefthook.yml')) return named('lefthook', 'lefthook.yml');
  if (present('.pre-commit-config.yaml')) return named('pre-commit', '.pre-commit-config.yaml');
  const husky = files.find((path) => huskyHooks.test(path));
  if (husky) return named('husky', husky);
  if (manifest.husky?.hooks) return named('husky-v4', 'package.json');
  if (hooksPath) return named('hooks-path', posix.join(hooksPath, 'pre-commit'));
  return named('git', '.git/hooks/pre-commit');
};

const unsupportedOf = ({ files, manifest, lintScript, supported }) => {
  const named = [
    ...files.filter((path) => legacyConfig.test(path)).map((config) => ({ tool: 'eslint', config, reason: 'legacy eslintrc config' })),
    ...(manifest.eslintConfig ? [{ tool: 'eslint', config: 'package.json', reason: 'legacy eslintConfig in package.json' }] : []),
    ...files.filter((path) => biomeConfig.test(path)).map((config) => ({ tool: 'biome', config, reason: 'biome has no plugin form' })),
  ];
  const scriptRunsUnconfigured =
    lintScript && !named.some(({ tool }) => tool === lintScript.tool) && !supported.some(({ tool }) => tool === lintScript.tool);
  return scriptRunsUnconfigured
    ? [...named, { tool: lintScript.tool, config: null, reason: `${lintScript.tool} runs the lint with no config file of a supported form` }]
    : named;
};

const versionOfRange = (range) => {
  const [first] = range?.match(/\d+(?:\.\d+){0,2}/) ?? [];
  return first && [...first.split('.'), '0', '0'].slice(0, 3).join('.');
};

const versionOf = ({ tool, files, read, manifest }) => {
  const locked = Object.entries(lockedVersionIn)
    .filter(([lockfile]) => files.includes(lockfile) && read(lockfile) !== undefined)
    .map(([lockfile, extract]) => ({ value: extract({ tool, text: read(lockfile) }), source: lockfile }))
    .find(({ value }) => value);
  if (locked) return locked;
  const value = versionOfRange({ ...manifest.dependencies, ...manifest.devDependencies }[tool]);
  return value ? { value, source: 'package.json range' } : null;
};

const supportedOf = (files) => [
  ...files.filter((path) => oxlintConfig.test(path)).map((config) => ({ tool: 'oxlint', config })),
  ...files.filter((path) => flatConfig.test(path)).map((config) => ({ tool: 'eslint', config })),
];

const shallowestFirst = (lintScript) => (a, b) =>
  depth(a.config) - depth(b.config) ||
  Number(b.tool === lintScript?.tool) - Number(a.tool === lintScript?.tool) ||
  a.tool.localeCompare(b.tool);

export const probeFiles = ({ files, read, hooksPath }) => {
  const own = ownFiles(files);
  const manifest = parsedManifest(read);
  const lintScript = lintScriptOf(manifest);
  const supported = supportedOf(own);
  const linters = supported
    .map((linter) => ({ ...linter, version: versionOf({ tool: linter.tool, files: own, read, manifest }) }))
    .sort(shallowestFirst(lintScript));
  const hook = hookOf({ files: own, manifest, hooksPath });
  return {
    linters,
    unsupported: unsupportedOf({ files: own, manifest, lintScript, supported }),
    lintScript,
    hook,
    pick: { linter: linters[0]?.tool ?? 'none', hook: hook.manager },
  };
};

export const coveringLinter = ({ linters }, file) =>
  linters.find(({ config }) => directoryOf(file).startsWith(directoryOf(config))) ?? null;

const gitFiles = (root) =>
  execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);

const walkedFiles = (root) =>
  readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1));

const treeFiles = (treeFile) =>
  readFileSync(treeFile, 'utf8')
    .split('\n')
    .map((line) => line.trim().replace(/^\.\//, ''))
    .filter(Boolean);

const hooksPathOf = (root) => {
  try {
    return execFileSync('git', ['config', 'core.hooksPath'], { cwd: root, encoding: 'utf8' }).trim() || undefined;
  } catch {
    return undefined;
  }
};

export const probeRepo = (root, { treeFile } = {}) => {
  const files = treeFile ? treeFiles(treeFile) : existsSync(join(root, '.git')) ? gitFiles(root) : walkedFiles(root);
  const read = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : undefined);
  return probeFiles({ files, read, hooksPath: treeFile ? undefined : hooksPathOf(root) });
};
