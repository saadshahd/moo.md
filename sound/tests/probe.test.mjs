import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { probeRepo, probeFiles } from '../lint/probe.mjs';
import { meetsFloor } from '../lint/tools.mjs';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../evals/fixtures');

const scoredFixtures = readdirSync(fixtures).filter((name) => existsSync(join(fixtures, name, 'expected.json')));

for (const name of scoredFixtures) {
  const { stack } = JSON.parse(readFileSync(join(fixtures, name, 'expected.json'), 'utf8'));
  test(`probe reads the ${name} fixture's linter and hook`, () => {
    const probed = probeRepo(join(fixtures, name, 'repo'), { treeFile: join(fixtures, name, 'repo/tree.txt') });
    assert.deepEqual(probed.pick, stack);
  });
}

const read = (files) => (path) => files[path];

test('a flat eslint config in a subdirectory outranks nothing at the root', () => {
  const probed = probeFiles({ files: ['packages/a/eslint.config.js', 'oxlint-unused.txt'], read: read({}) });
  assert.deepEqual(probed.linters, [{ tool: 'eslint', config: 'packages/a/eslint.config.js', version: null }]);
});

test('the shallowest config wins, and a tie goes to the tool the lint script runs', () => {
  const files = ['.oxlintrc.json', 'eslint.config.mjs'];
  const lintWith = (command) => read({ 'package.json': JSON.stringify({ scripts: { lint: command } }) });
  assert.equal(probeFiles({ files, read: lintWith('eslint .') }).pick.linter, 'eslint');
  assert.equal(probeFiles({ files, read: lintWith('oxlint') }).pick.linter, 'oxlint');
});

test('configs inside worktrees and node_modules are not the repo\'s own', () => {
  const probed = probeFiles({ files: ['.claude/worktrees/x/eslint.config.js', 'node_modules/p/.oxlintrc.json'], read: read({}) });
  assert.deepEqual(probed.linters, []);
});

test('husky v4 lives in package.json, husky v9 in .husky', () => {
  const v4 = probeFiles({ files: [], read: read({ 'package.json': JSON.stringify({ husky: { hooks: { 'pre-commit': 'x' } } }) }) });
  assert.equal(v4.hook.manager, 'husky-v4');
  assert.equal(probeFiles({ files: ['.husky/pre-commit'], read: read({}) }).hook.manager, 'husky');
});

test('core.hooksPath names the folder the gate is wired in', () => {
  const probed = probeFiles({ files: [], read: read({}), hooksPath: 'git-hooks' });
  assert.deepEqual(probed.hook, { manager: 'hooks-path', file: 'git-hooks/pre-commit' });
});

const lockedVersions = [
  ['package-lock.json', JSON.stringify({ packages: { 'node_modules/oxlint': { version: '1.26.0' } } })],
  ['pnpm-lock.yaml', 'importers:\n  .:\n    devDependencies:\n      oxlint:\n        specifier: ^1.20.0\n        version: 1.26.0\npackages:\n  oxlint@1.26.0:\n    resolution: {integrity: x}\n'],
  ['yarn.lock', 'oxlint@^1.20.0:\n  version "1.26.0"\n'],
  ['yarn.lock', '"oxlint@npm:^1.20.0":\n  version: 1.26.0\n'],
  ['bun.lock', '{ "packages": { "oxlint": ["oxlint@1.26.0", "", {}] } }'],
];

lockedVersions.forEach(([lockfile, text], index) => {
  test(`the oxlint version comes from the lockfile, not the range (${lockfile} #${index})`, () => {
    const manifest = JSON.stringify({ devDependencies: { oxlint: '^1.0.0' } });
    const probed = probeFiles({ files: ['.oxlintrc.json', lockfile], read: read({ [lockfile]: text, 'package.json': manifest }) });
    assert.deepEqual(probed.linters[0].version, { value: '1.26.0', source: lockfile });
  });
});

test('without a lockfile the version is the lowest the package.json range allows', () => {
  const versionFor = (range) =>
    probeFiles({ files: ['eslint.config.mjs'], read: read({ 'package.json': JSON.stringify({ devDependencies: { eslint: range } }) }) }).linters[0].version;
  assert.deepEqual(versionFor('^8.57'), { value: '8.57.0', source: 'package.json range' });
  assert.deepEqual(versionFor('9'), { value: '9.0.0', source: 'package.json range' });
  assert.equal(versionFor('latest'), null);
});

test('versions compare by number, not by text', () => {
  assert.equal(meetsFloor({ tool: 'oxlint', version: '1.100.0' }), true);
  assert.equal(meetsFloor({ tool: 'oxlint', version: '1.4.0' }), false);
  assert.equal(meetsFloor({ tool: 'oxlint', version: '1.26.0' }), true);
});
