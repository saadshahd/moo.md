import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pluginFile } from './plugin.mjs';
import { coveringLinter, probeRepo } from './probe.mjs';
import { binaryFor, configDirectoryOf, runLint } from './tools.mjs';

const changedFiles = (root, range) =>
  execFileSync('git', ['diff', ...(range ? [range] : ['--cached']), '--name-only', '--diff-filter=ACMR', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

export const reviewHits = ({ root, range }) => {
  if (!existsSync(join(root, pluginFile))) return [];
  const probe = probeRepo(root);
  const filesByLinter = Map.groupBy(
    changedFiles(root, range).map((file) => ({ file, linter: coveringLinter(probe, file) })).filter(({ linter }) => linter),
    ({ linter }) => linter,
  );
  return [...filesByLinter].flatMap(([linter, entries]) => {
    const bin = binaryFor({ root, config: linter.config, tool: linter.tool });
    if (!bin) throw new Error(`${linter.tool} is not installed in the repo; install its dependencies first`);
    const directory = posix.dirname(linter.config);
    const { hits } = runLint({
      tool: linter.tool,
      bin,
      cwd: configDirectoryOf({ root, config: linter.config }),
      config: join(root, linter.config),
      files: entries.map(({ file }) => posix.relative(directory, file)),
    });
    return hits.filter((hit) => hit.ruleId?.startsWith('sound/')).map((hit) => ({ ...hit, file: posix.join(directory === '.' ? '' : directory, hit.file) }));
  });
};
