import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tools } from '../lint/tools.mjs';

export const matrix = [
  { tool: 'eslint', version: tools.eslint.floor },
  { tool: 'eslint', version: '9' },
  { tool: 'eslint', version: '10' },
  { tool: 'oxlint', version: tools.oxlint.floor },
  { tool: 'oxlint', version: 'latest' },
];

const installRoot = join(tmpdir(), 'sound-linters');

const packagesFor = ({ tool, version }) =>
  tool === 'eslint' ? [`eslint@${version}`, '@typescript-eslint/parser@8', 'typescript@5'] : [`oxlint@${version}`];

export const installLinter = (linter) => {
  const directory = join(installRoot, `${linter.tool}-${linter.version}`);
  const bin = join(directory, 'node_modules/.bin', linter.tool);
  const parserPath = join(directory, 'node_modules/@typescript-eslint/parser/dist/index.js');
  if (!existsSync(bin)) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'package.json'), '{"private":true}');
    const install = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...packagesFor(linter)], {
      cwd: directory,
      encoding: 'utf8',
    });
    if (install.status !== 0) return { skip: `npm install of ${linter.tool}@${linter.version} failed: ${install.stderr}` };
  }
  return { bin, parserPath: linter.tool === 'eslint' ? parserPath : undefined };
};
