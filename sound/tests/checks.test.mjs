import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { caseFailures, caseList, lintCases, loadCheck } from '../lint/cases.mjs';
import { checkSuffix, corpusFiles } from '../lint/corpora.mjs';
import { pluginSource } from '../lint/plugin.mjs';
import { tools } from '../lint/tools.mjs';
import { installLinter, matrix } from './linters.mjs';

const checkPaths = corpusFiles(checkSuffix).map(({ corpus, path }) => join(corpus, path));

for (const linter of matrix) {
  for (const checkPath of checkPaths) {
    const rule = basename(checkPath, checkSuffix);
    test(`${rule} passes its own cases on ${linter.tool}@${linter.version}`, async (t) => {
      const installed = installLinter(linter);
      if (installed.skip) return t.skip(installed.skip);
      const directory = mkdtempSync(join(tmpdir(), 'sound-cases-'));
      const pluginPath = join(directory, 'plugin.mjs');
      writeFileSync(pluginPath, pluginSource([{ rule, specifier: checkPath }]));
      const adapter = tools[linter.tool];
      const config = join(directory, adapter.scanConfigFile);
      writeFileSync(config, adapter.scanConfig({ pluginPath, parserPath: installed.parserPath, rules: [rule] }));
      const cases = caseList(await loadCheck(checkPath));
      const hitsByCase = lintCases({ tool: linter.tool, bin: installed.bin, directory, config, cases });
      assert.deepEqual(caseFailures({ rule, cases, hitsByCase }), []);
    });
  }
}
