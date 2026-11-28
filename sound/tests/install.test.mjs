import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { reviewHits } from '../lint/hits.mjs';
import { checkSuffix, corpora, corpusFiles } from '../lint/corpora.mjs';
import { installChecks } from '../lint/install.mjs';
import { runLint } from '../lint/tools.mjs';
import { ManualWiring, wireEslint } from '../lint/wire.mjs';
import { installLinter } from './linters.mjs';

const shippedChecks = corpusFiles(checkSuffix).map(({ path }) => ({ rule: basename(path, checkSuffix), topic: dirname(path), cite: 'src/list.tsx' }));
const keysRule = { rule: 'keys-are-identity-not-position', topic: 'effects', cite: 'src/list.tsx' };
const violation = 'export const List = ({ rows }) => <ul>{rows.map((row, index) => <li key={index}>{row}</li>)}</ul>;\n';

const eslintConfig = `import parser from '@typescript-eslint/parser';
export default [
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } }, rules: {} },
];
`;

const repoFor = (linter, files) => {
  const installed = installLinter(linter);
  if (installed.skip) return { skip: installed.skip };
  const root = mkdtempSync(join(tmpdir(), 'sound-install-'));
  symlinkSync(join(dirname(installed.bin), '..'), join(root, 'node_modules'));
  Object.entries({ 'package.json': '{"private":true}', 'src/list.tsx': violation, ...files }).forEach(([path, text]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  });
  return { root, installed };
};

const corpusWith = (checks) => {
  const directory = mkdtempSync(join(tmpdir(), 'sound-corpus-'));
  Object.entries(checks).forEach(([name, source]) => {
    mkdirSync(join(directory, 'test'), { recursive: true });
    writeFileSync(join(directory, 'test', `${name}${checkSuffix}`), source);
  });
  return directory;
};

const debuggerCheck = `export default { meta: { type: 'problem', schema: [] }, create: (context) => ({ DebuggerStatement: (node) => context.report({ node, message: 'no debugger' }) }) };
export const cases = { valid: [{ code: 'const a = 1;' }], invalid: [{ code: 'debugger;', errors: 1 }] };
`;

const forbiddenNameCheck = `export default { meta: { type: 'problem', schema: [] }, create: (context) => ({ Identifier: (node) => node.name === 'forbiddenName' && context.report({ node, message: 'forbidden name' }) }) };
export const cases = { valid: [{ code: 'export const a = allowedName;' }], invalid: [{ code: 'export const a = forbiddenName;', errors: 1 }] };
`;

const silentCheck = `export default { meta: { type: 'suggestion', schema: [] }, create: () => ({}) };
export const cases = { valid: [{ code: 'const a = 1;' }], invalid: [{ code: 'const b = 2;', errors: 1 }] };
`;

const lintHits = ({ root, installed, linter }) =>
  runLint({ tool: linter.tool, bin: installed.bin, cwd: root, config: join(root, linter.config), files: ['.'] }).hits;

const linters = [
  {
    tool: 'eslint',
    version: '9',
    config: 'eslint.config.mjs',
    text: eslintConfig,
    ignoringLongFiles: eslintConfig.replace('export default [\n', "export default [\n  { ignores: ['.claude/**'] },\n  { rules: { 'max-lines': ['error', 20] } },\n"),
  },
  {
    tool: 'oxlint',
    version: 'latest',
    config: '.oxlintrc.json',
    text: '{\n  "rules": {}\n}\n',
    ignoringLongFiles: '{\n  "ignorePatterns": [".claude/**"],\n  "rules": { "max-lines": ["error", 20] }\n}\n',
  },
];

for (const linter of linters) {
  describe(`installing a check into ${linter.tool}@${linter.version}`, () => {
    test('wires, fires through the repo config, and is idempotent', async (t) => {
      const repo = repoFor(linter, { [linter.config]: linter.text });
      if (repo.skip) return t.skip(repo.skip);
      const first = await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true });
      assert.deepEqual(first.map(({ rule, status, severity }) => ({ rule, status, severity })), [{ rule: keysRule.rule, status: 'installed', severity: 'warn' }]);
      assert.equal(first[0].repoHits, 1);
      const hits = lintHits({ root: repo.root, installed: repo.installed, linter }).filter((hit) => hit.ruleId === `sound/${keysRule.rule}`);
      assert.equal(hits.length, 1);
      const wired = readFileSync(join(repo.root, linter.config), 'utf8');
      await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true });
      assert.equal(readFileSync(join(repo.root, linter.config), 'utf8'), wired);
    });

    test('every shipped check installs together, and none is reverted or cannot run', async (t) => {
      const repo = repoFor(linter, { [linter.config]: linter.text });
      if (repo.skip) return t.skip(repo.skip);
      const rows = await installChecks({ root: repo.root, corpora, selected: shippedChecks, write: true });
      assert.deepEqual(rows.filter(({ status }) => !['installed', 'covered'].includes(status)).map(({ rule, status, note }) => ({ rule, status, note })), []);
    });

    test('lints only the files the repo config lints, so a check file the config ignores adds no failure', async (t) => {
      const repo = repoFor(linter, { [linter.config]: linter.ignoringLongFiles });
      if (repo.skip) return t.skip(repo.skip);
      const rows = await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true });
      assert.deepEqual(rows.map(({ status, note }) => ({ status, note })), [{ status: 'installed', note: undefined }]);
    });

    test('a dry run measures and leaves the repo byte-for-byte as it was', async (t) => {
      const repo = repoFor(linter, { [linter.config]: linter.text });
      if (repo.skip) return t.skip(repo.skip);
      const rows = await installChecks({ root: repo.root, corpora, selected: [keysRule] });
      assert.equal(rows[0].status, 'would-install');
      assert.equal(readFileSync(join(repo.root, linter.config), 'utf8'), linter.text);
      assert.equal(existsSync(join(repo.root, '.claude')), false);
    });

    test('a problem check is an error where the repo has no hits and a warning where it has some', async (t) => {
      const repo = repoFor(linter, { [linter.config]: linter.text });
      if (repo.skip) return t.skip(repo.skip);
      const options = { root: repo.root, corpora: [corpusWith({ forbidden: forbiddenNameCheck })], selected: [{ rule: 'forbidden', topic: 'test', cite: 'src/list.tsx' }] };
      assert.equal((await installChecks(options))[0].severity, 'error');
      writeFileSync(join(repo.root, 'src/dirty.ts'), 'export const b = forbiddenName;\n');
      assert.equal((await installChecks(options))[0].severity, 'warn');
    });

    test('a check that does not fire through the repo config is reverted', async (t) => {
      const repo = repoFor(linter, { [linter.config]: linter.text });
      if (repo.skip) return t.skip(repo.skip);
      const rows = await installChecks({ root: repo.root, corpora: [corpusWith({ silent: silentCheck })], selected: [{ rule: 'silent', topic: 'test', cite: 'src/list.tsx' }], write: true });
      assert.equal(rows[0].status, 'reverted');
      assert.match(rows[0].note, /does not fire/);
      assert.equal(readFileSync(join(repo.root, linter.config), 'utf8'), linter.text);
      assert.equal(existsSync(join(repo.root, '.claude')), false);
    });

    test('a check that only a later corpus holds still installs', async (t) => {
      const repo = repoFor(linter, { [linter.config]: linter.text });
      if (repo.skip) return t.skip(repo.skip);
      const rows = await installChecks({ root: repo.root, corpora: [corpusWith({}), corpusWith({ forbidden: forbiddenNameCheck })], selected: [{ rule: 'forbidden', topic: 'test', cite: 'src/list.tsx' }] });
      assert.equal(rows[0]?.status, 'would-install');
    });
  });
}

describe('a linter older than the lowest tested version', () => {
  test('the failure names the version, and the repo is left as it was', async (t) => {
    const repo = repoFor({ tool: 'oxlint', version: '1.21.0' }, { [linters[1].config]: linters[1].text, 'package.json': '{"devDependencies":{"oxlint":"1.21.0"}}' });
    if (repo.skip) return t.skip(repo.skip);
    const rows = await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true });
    assert.equal(rows[0].status, 'reverted');
    assert.match(rows[0].note, /report that cannot be read/);
    assert.match(rows[0].note, /oxlint 1\.21\.0 from package\.json range is older than 1\.26\.0/);
    assert.equal(readFileSync(join(repo.root, linters[1].config), 'utf8'), linters[1].text);
  });
});

describe('reviewing a staged diff', () => {
  test('reports the installed checks\' hits on the changed files only', async (t) => {
    const repo = repoFor(linters[0], { 'eslint.config.mjs': eslintConfig, 'src/clean.tsx': 'export const Clean = () => <p />;\n' });
    if (repo.skip) return t.skip(repo.skip);
    const git = (...args) => execFileSync('git', args, { cwd: repo.root });
    git('init', '-q');
    git('add', '-f', 'package.json', 'eslint.config.mjs', 'src/clean.tsx');
    await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true });
    git('add', '-f', '.claude');
    assert.deepEqual(reviewHits({ root: repo.root }), []);
    git('add', '-f', 'src/list.tsx');
    const hits = reviewHits({ root: repo.root });
    assert.deepEqual(hits.map(({ file, ruleId, line }) => ({ file, ruleId, line })), [{ file: 'src/list.tsx', ruleId: `sound/${keysRule.rule}`, line: 1 }]);
  });

  test('has nothing to report where no check is installed', (t) => {
    const repo = repoFor(linters[0], { 'eslint.config.mjs': eslintConfig });
    if (repo.skip) return t.skip(repo.skip);
    execFileSync('git', ['init', '-q'], { cwd: repo.root });
    assert.deepEqual(reviewHits({ root: repo.root }), []);
  });
});

describe('a repo whose own lint already flags the check\'s invalid cases', () => {
  test('reports the repo rule that covers it and installs nothing', async (t) => {
    const repo = repoFor(linters[0], { 'eslint.config.mjs': eslintConfig.replace('rules: {}', "rules: { 'no-debugger': 'error' }") });
    if (repo.skip) return t.skip(repo.skip);
    const rows = await installChecks({ root: repo.root, corpora: [corpusWith({ debugger: debuggerCheck })], selected: [{ rule: 'debugger', topic: 'test', cite: 'src/list.tsx' }], write: true });
    assert.deepEqual(rows.map(({ status, covered }) => ({ status, covered })), [{ status: 'covered', covered: [{ ruleId: 'no-debugger', file: 'eslint.config.mjs' }] }]);
    assert.equal(existsSync(join(repo.root, '.claude')), false);
  });

  test('shows a repo rule that flags the check\'s valid cases as a clash', async (t) => {
    const clashing = eslintConfig.replace('rules: {}', "rules: { 'no-unused-vars': 'warn' }");
    const repo = repoFor(linters[0], { 'eslint.config.mjs': clashing });
    if (repo.skip) return t.skip(repo.skip);
    const rows = await installChecks({ root: repo.root, corpora: [corpusWith({ debugger: debuggerCheck })], selected: [{ rule: 'debugger', topic: 'test', cite: 'src/list.tsx' }] });
    assert.deepEqual(rows.map(({ status, clashes }) => ({ status, clashes })), [{ status: 'would-install', clashes: ['no-unused-vars'] }]);
  });
});

describe('the generated plugin entry', () => {
  test('passes a repo rule that wants a blank line after the imports', async (t) => {
    const blankAfterImports = "{ rules: { 'padding-line-between-statements': ['error', { blankLine: 'always', prev: 'import', next: '*' }, { blankLine: 'any', prev: 'import', next: 'import' }] } }";
    const repo = repoFor(linters[0], { 'eslint.config.mjs': eslintConfig.replace("';\nexport default [\n", `';\n\nexport default [\n  ${blankAfterImports},\n`) });
    if (repo.skip) return t.skip(repo.skip);
    const rows = await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true });
    assert.deepEqual(rows.map(({ status, note }) => ({ status, note })), [{ status: 'installed', note: undefined }]);
  });
});

describe('a rule the repo\'s lint cannot run', () => {
  test('a cited file no supported config covers is reported, not wired', async (t) => {
    const repo = repoFor(linters[0], { 'packages/a/eslint.config.mjs': eslintConfig });
    if (repo.skip) return t.skip(repo.skip);
    const rows = await installChecks({ root: repo.root, corpora, selected: [{ ...keysRule, cite: 'packages/b/x.tsx' }] });
    assert.equal(rows[0].status, 'no-linter');
  });

  test('a commented oxlint config comes back as exact lines to add by hand', async (t) => {
    const repo = repoFor(linters[1], { '.oxlintrc.json': '{\n  // mine\n  "rules": {}\n}\n' });
    if (repo.skip) return t.skip(repo.skip);
    const rows = await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true });
    assert.equal(rows[0].status, 'manual');
    assert.match(rows[0].note, /"jsPlugins"/);
    assert.equal(readFileSync(join(repo.root, '.oxlintrc.json'), 'utf8'), '{\n  // mine\n  "rules": {}\n}\n');
  });
});

describe('re-running over an edited check file', () => {
  const rerun = async (resolution, t) => {
    const repo = repoFor(linters[0], { 'eslint.config.mjs': eslintConfig });
    if (repo.skip) return t.skip(repo.skip);
    await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true });
    const installedFile = join(repo.root, '.claude/sound/effects/keys-are-identity-not-position.check.mjs');
    const theirs = readFileSync(installedFile, 'utf8') + '\n';
    writeFileSync(installedFile, theirs);
    const rows = await installChecks({ root: repo.root, corpora, selected: [keysRule], write: true, resolutions: resolution ? { [keysRule.rule]: resolution } : {} });
    return { rows, installedFile, theirs };
  };

  test('asks, and changes nothing, until told which version wins', async (t) => {
    const { rows, installedFile, theirs } = (await rerun(undefined, t)) ?? {};
    if (!rows) return;
    assert.equal(rows[0].status, 'conflict');
    assert.equal(readFileSync(installedFile, 'utf8'), theirs);
  });

  test('keep theirs leaves their file wired', async (t) => {
    const { rows, installedFile, theirs } = (await rerun('theirs', t)) ?? {};
    if (!rows) return;
    assert.equal(rows[0].status, 'installed');
    assert.equal(readFileSync(installedFile, 'utf8'), theirs);
  });

  test('take corpus replaces theirs', async (t) => {
    const { rows, installedFile, theirs } = (await rerun('corpus', t)) ?? {};
    if (!rows) return;
    assert.equal(rows[0].status, 'installed');
    assert.notEqual(readFileSync(installedFile, 'utf8'), theirs);
  });

  test('keep both moves theirs to a local name and wires the corpus copy', async (t) => {
    const { rows, installedFile, theirs } = (await rerun('both', t)) ?? {};
    if (!rows) return;
    assert.equal(rows[0].status, 'installed');
    assert.equal(readFileSync(installedFile.replace('.check.mjs', '.local.check.mjs'), 'utf8'), theirs);
    assert.notEqual(readFileSync(installedFile, 'utf8'), theirs);
  });
});

describe('editing an eslint flat config', () => {
  const rootWithEslint = () => {
    const installed = installLinter(linters[0]);
    return installed.skip ? { skip: installed.skip } : { root: dirname(dirname(installed.bin)).replace(/node_modules$/, '') };
  };
  const wire = (text, root) => wireEslint({ text, root, pluginSpecifier: './.claude/sound/plugin.mjs', severities: { 'sound/x': 'warn' } });
  const shapes = {
    'a default-exported array': 'export default [\n  { rules: {} },\n];\n',
    'an array without a trailing comma': 'export default [{ rules: {} }];\n',
    'a defineConfig call': "import { defineConfig } from 'eslint/config';\nexport default defineConfig([{ rules: {} }]);\n",
    'a variadic config call': "import tseslint from 'typescript-eslint';\nexport default tseslint.config({ rules: {} }, { files: ['a'] });\n",
    'an array held in a variable': 'const config = [{ rules: {} }];\nexport default config;\n',
    'an empty array': 'export default [];\n',
  };

  for (const [name, text] of Object.entries(shapes)) {
    test(`appends the sound entry to ${name}`, (t) => {
      const { root, skip } = rootWithEslint();
      if (skip) return t.skip(skip);
      const wired = wire(text, root);
      assert.match(wired, /plugins: \{ sound \}/);
      assert.match(wired, /import sound from ".\/.claude\/sound\/plugin.mjs";/);
      assert.equal(wire(wired, root), wired);
    });
  }

  test('a CommonJS config is handed back as lines to add by hand', (t) => {
    const { root, skip } = rootWithEslint();
    if (skip) return t.skip(skip);
    assert.throws(() => wire('module.exports = [];\n', root), ManualWiring);
  });
});
