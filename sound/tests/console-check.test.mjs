import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { pluginSource } from '../lint/plugin.mjs';
import { runLint, tools } from '../lint/tools.mjs';
import { installLinter } from './linters.mjs';

const rule = 'side-effects-visible-at-the-call-site';
const checkPath = resolve(dirname(fileURLToPath(import.meta.url)), '../corpus/effects', `${rule}.check.mjs`);
const linter = { tool: 'eslint', version: '9' };
const shipped = 'src/billing/charge.ts';
const unshipped = ['tests/charge.ts', 'src/__tests__/charge.ts', 'src/charge.test.ts', 'scripts/seed.ts', 'bench/charge.ts', 'examples/charge.ts', 'demo-ui.js', 'vite.config.ts', 'evals/run.mjs'];

test('the console check skips code that does not ship, and flags the same call in shipped code', (t) => {
  const installed = installLinter(linter);
  if (installed.skip) return t.skip(installed.skip);
  const directory = mkdtempSync(join(tmpdir(), 'sound-console-'));
  const pluginPath = join(directory, 'plugin.mjs');
  writeFileSync(pluginPath, pluginSource([{ rule, specifier: checkPath }]));
  const config = join(directory, tools.eslint.scanConfigFile);
  writeFileSync(config, tools.eslint.scanConfig({ pluginPath, parserPath: installed.parserPath, rules: [rule] }));
  const files = [shipped, ...unshipped];
  files.forEach((file) => {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    writeFileSync(join(directory, file), 'console.log("charged");\n');
  });
  const { hits } = runLint({ tool: linter.tool, bin: installed.bin, cwd: directory, config, files });
  assert.deepEqual(hits.filter((hit) => hit.ruleId === `sound/${rule}`).map((hit) => hit.file), [shipped]);
});
