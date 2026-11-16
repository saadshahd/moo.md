import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const evals = join(dirname(fileURLToPath(import.meta.url)), '../evals');
const fixture = join(evals, 'fixtures/bot-distributed');
const hasBun = spawnSync('bun', ['--version']).status === 0;

const scoreWith = (pick) => {
  const file = join(mkdtempSync(join(tmpdir(), 'sound-score-')), 'proposal.json');
  writeFileSync(file, JSON.stringify({ tags: [], stack: pick, rules: [] }));
  return spawnSync('bun', [join(evals, 'score.mjs'), fixture, file], { encoding: 'utf8' }).stdout;
};

test('the scorer passes the expected pick', (t) => {
  if (!hasBun) return t.skip('bun is not installed');
  const output = scoreWith({ linter: 'oxlint', hook: 'pre-commit' });
  assert.match(output, /PASS  pick:linter/);
  assert.match(output, /PASS  pick:hook/);
});

test('the scorer fails a wrong linter and a wrong hook, each on its own line', (t) => {
  if (!hasBun) return t.skip('bun is not installed');
  const output = scoreWith({ linter: 'eslint', hook: 'git' });
  assert.match(output, /FAIL  pick:linter +expected oxlint got eslint/);
  assert.match(output, /FAIL  pick:hook +expected pre-commit got git/);
});
