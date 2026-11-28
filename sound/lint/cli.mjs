#!/usr/bin/env node
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { checkSuffix, corpora, corpusFiles } from './corpora.mjs';
import { reviewHits } from './hits.mjs';
import { installChecks } from './install.mjs';
import { probeRepo } from './probe.mjs';

const topicOf = (rule) => {
  const found = corpusFiles(checkSuffix).find(({ path }) => basename(path, checkSuffix) === rule);
  if (!found) throw new Error(`no check in the corpus for rule ${rule}`);
  return found.path.split('/')[0];
};

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    tree: { type: 'string' },
    rule: { type: 'string', multiple: true },
    resolve: { type: 'string', multiple: true },
    write: { type: 'boolean' },
    range: { type: 'string' },
  },
});
const [command, rootArgument] = positionals;
const root = resolve(rootArgument ?? '.');
const pair = (text) => {
  const at = text.indexOf('=');
  return [text.slice(0, at), text.slice(at + 1)];
};

const commands = {
  probe: () => probeRepo(root, { treeFile: values.tree && resolve(values.tree) }),
  install: () =>
    installChecks({
      root,
      corpora,
      write: values.write,
      selected: (values.rule ?? []).map(pair).map(([rule, cite]) => ({ rule, topic: topicOf(rule), cite })),
      resolutions: Object.fromEntries((values.resolve ?? []).map(pair)),
    }),
  hits: () => reviewHits({ root, range: values.range }),
};

if (!commands[command]) throw new Error(`usage: cli.mjs <${Object.keys(commands).join('|')}> <repo-root> [options]`);
process.stdout.write(`${JSON.stringify(await commands[command](), null, 2)}\n`);
