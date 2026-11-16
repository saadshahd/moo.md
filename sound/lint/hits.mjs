import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { coveringLinter, probeRepo } from './probe.mjs';
import { runLint } from './tools.mjs';

const pluginFile = '.claude/sound/plugin.mjs';

const changedFiles = (root, range) =>
  execFileSync('git', ['diff', ...(range ? [range] : ['--cached']), '--name-only', '--diff-filter=ACMR', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

const binaryIn = (root, config, tool) => {
  const candidates = [join(root, posix.dirname(config), 'node_modules/.bin', tool), join(root, 'node_modules/.bin', tool)];
  return candidates.find(existsSync);
};

export const reviewHits = ({ root, range }) => {
  if (!existsSync(join(root, pluginFile))) return [];
  const probe = probeRepo(root);
  const filesByLinter = Map.groupBy(
    changedFiles(root, range).map((file) => ({ file, linter: coveringLinter(probe, file) })).filter(({ linter }) => linter),
    ({ linter }) => linter,
  );
  return [...filesByLinter].flatMap(([linter, entries]) => {
    const bin = binaryIn(root, linter.config, linter.tool);
    if (!bin) throw new Error(`${linter.tool} is not installed in the repo; install its dependencies first`);
    const directory = posix.dirname(linter.config);
    const { hits } = runLint({
      tool: linter.tool,
      bin,
      cwd: join(root, directory),
      config: join(root, linter.config),
      files: entries.map(({ file }) => posix.relative(directory, file)),
    });
    return hits.filter((hit) => hit.ruleId?.startsWith('sound/')).map((hit) => ({ ...hit, file: posix.join(directory === '.' ? '' : directory, hit.file) }));
  });
};
