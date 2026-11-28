#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSuffix, corpusFiles } from '../../lint/corpora.mjs';
import { pluginSource } from '../../lint/plugin.mjs';
import { runLint, tools } from '../../lint/tools.mjs';
import { installLinter } from '../../tests/linters.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const gateSuffix = '.gate';
const gateHitLine = /^ {2}(\S+) {2}\((.+)\)$/;
const confidenceZ = 1.96;
const sampleFlag = process.argv.indexOf('--sample');
const sampleSize = sampleFlag === -1 ? 30 : Number(process.argv[sampleFlag + 1]);
const anchorLines = 3;
const anchorLength = 160;

const { rules: unmeasured } = JSON.parse(readFileSync(join(here, 'unmeasured.json'), 'utf8'));

const rulePaths = (suffix) =>
  corpusFiles(suffix)
    .filter(({ path }) => !(basename(path, suffix) in unmeasured))
    .map(({ corpus, path }) => join(corpus, path));

const lineAt = (corpus, { source, file, line }) =>
  readFileSync(join(corpus, source, file), 'utf8')
    .split('\n')
    .slice(line - 1, line - 1 + anchorLines)
    .map((text) => text.trim())
    .join(' ⏎ ')
    .slice(0, anchorLength);

const wilsonUpper = (failures, total) => {
  if (total === 0) return NaN;
  const p = failures / total;
  const z2 = confidenceZ ** 2;
  const centre = p + z2 / (2 * total);
  const spread = confidenceZ * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total ** 2));
  return (centre + spread) / (1 + z2 / total);
};

const withoutCopies = (hits) => {
  const seen = new Set();
  return hits.filter((hit) => {
    const key = `${basename(hit.file)}|${hit.anchor}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
};

const sampleOf = ({ hits, labels }) => {
  const order = (hit) => createHash('sha1').update(`${hit.source}|${hit.file}|${hit.line}|${hit.anchor}`).digest('hex');
  const labeled = new Set(labels.map(labelKey));
  const known = hits.filter((hit) => labeled.has(labelKey(hit)));
  const unknown = hits.filter((hit) => !labeled.has(labelKey(hit))).sort((a, b) => order(a).localeCompare(order(b)));
  return [...known, ...unknown.slice(0, Math.max(0, sampleSize - known.length))];
};

const labelKey = ({ source, file, line }) => `${source}|${file}|${line}`;

const sourceDirectories = (corpus) =>
  readdirSync(corpus).filter((name) => statSync(join(corpus, name)).isDirectory() && !name.startsWith('.'));

const scanLint = ({ rule, path, corpus, linter, installed }) => {
  const work = mkdtempSync(join(tmpdir(), 'sound-measure-'));
  const pluginPath = join(work, 'plugin.mjs');
  writeFileSync(pluginPath, pluginSource([{ rule, specifier: path }]));
  const adapter = tools[linter.tool];
  const config = join(work, adapter.scanConfigFile);
  writeFileSync(config, adapter.scanConfig({ pluginPath, parserPath: installed.parserPath, rules: [rule] }));
  return sourceDirectories(corpus).flatMap((source) => {
    const { hits } = runLint({ tool: linter.tool, bin: installed.bin, cwd: join(corpus, source), config, files: ['.'] });
    return hits
      .filter((hit) => hit.ruleId === `sound/${rule}`)
      .map((hit) => ({ source, file: hit.file, line: hit.line, anchor: lineAt(corpus, { source, file: hit.file, line: hit.line }) }));
  });
};

const stageEverything = (directory) => {
  if (existsSync(join(directory, '.git'))) return;
  for (const args of [['init', '-q'], ['add', '-A', '-f']]) {
    const run = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    if (run.status !== 0) throw new Error(`git ${args[0]} failed in ${directory}: ${run.stderr}`);
  }
};

const scanGate = ({ path, corpus }) =>
  sourceDirectories(corpus).flatMap((source) => {
    const directory = join(corpus, source);
    stageEverything(directory);
    const run = spawnSync('/bin/bash', [path], { cwd: directory, encoding: 'utf8' });
    if (run.status !== 0 && run.status !== 1) throw new Error(`gate exited ${run.status} in ${source}: ${run.stderr}`);
    if (/crashed at line/.test(run.stderr)) throw new Error(`gate crashed in ${source}: ${run.stderr}`);
    return run.stderr
      .split('\n')
      .map((line) => line.match(gateHitLine))
      .filter(Boolean)
      .map(([, file, words]) => ({ source, file, line: 0, anchor: `${file} (${words})` }));
  });

const classify = ({ hits, all, labels }) => {
  const byKey = new Map(labels.map((entry) => [labelKey(entry), entry]));
  const matched = hits.map((hit) => ({ hit, entry: byKey.get(labelKey(hit)) }));
  const stale = labels.filter((entry) => !all.some((hit) => labelKey(hit) === labelKey(entry) && hit.anchor === entry.anchor));
  return { matched, stale };
};

const countBy = (matched, label) => matched.filter(({ entry }) => entry?.label === label).length;

const measureRule = ({ rule, scan }) => {
  const { labels } = JSON.parse(readFileSync(join(here, 'labels', `${rule}.json`), 'utf8'));
  const all = scan();
  const distinct = withoutCopies(all);
  const hits = sampleOf({ hits: distinct, labels });
  const { matched, stale } = classify({ hits, all: distinct, labels });
  const unlabeled = matched.filter(({ entry }) => !entry).map(({ hit }) => hit);
  const counts = { true: countBy(matched, 'true'), false: countBy(matched, 'false'), unclear: countBy(matched, 'unclear') };
  const bySource = Object.groupBy(matched, ({ hit }) => hit.source);
  const distinctBySource = Object.fromEntries(Object.entries(Object.groupBy(distinct, (hit) => hit.source)).map(([source, rows]) => [source, rows.length]));
  return { rule, total: distinct.length, distinctBySource, sampled: hits.length, copies: all.length - distinct.length, ...counts, unlabeled, stale, bySource };
};

const describe = (result) => {
  const rate = result.sampled === 0 ? 'no hits' : `${result.false}/${result.sampled} false = ${((100 * result.false) / result.sampled).toFixed(1)}% (95% upper bound ${(100 * wilsonUpper(result.false, result.sampled)).toFixed(1)}%)`;
  const sources = Object.entries(result.distinctBySource).map(([source, count]) => `    ${source}: ${count} hits, ${result.bySource[source]?.length ?? 0} labeled`);
  return [
    result.rule,
    `  hits ${result.total}, labeled ${result.sampled} (${result.copies} duplicate copies skipped): true ${result.true}, false ${result.false}, unclear ${result.unclear}, unlabeled ${result.unlabeled.length}, stale labels ${result.stale.length}`,
    `  false-hit rate: ${rate}`,
    ...sources,
    ...result.unlabeled.map((hit) => `  UNLABELED ${hit.source} ${hit.file}:${hit.line}  ${hit.anchor}`),
    ...result.stale.map((entry) => `  STALE LABEL ${entry.source} ${entry.file}:${entry.line}  ${entry.anchor}`),
  ].join('\n');
};

const asJson = process.argv.includes('--json');
const ruleFlag = process.argv.indexOf('--rule');
const onlyRule = ruleFlag === -1 ? undefined : process.argv[ruleFlag + 1];
const flagValues = new Set(['--rule', '--sample']);
const positional = process.argv.slice(2).filter((argument, index, all) => argument !== '--json' && !flagValues.has(argument) && !flagValues.has(all[index - 1]));
const [corpusArgument, linterArgument = 'oxlint@latest'] = positional;
if (!corpusArgument) throw new Error('usage: node measure.mjs <corpus-directory> [oxlint@latest|eslint@9|...] [--json] [--rule <name>] [--sample <n>]');
const corpus = resolve(corpusArgument);
const [tool, version] = linterArgument.split('@');
const installed = installLinter({ tool, version });
if (installed.skip) throw new Error(installed.skip);
const linter = { tool };

const rules = [
  ...rulePaths(checkSuffix).map((path) => ({ rule: basename(path, checkSuffix), scan: () => scanLint({ rule: basename(path, checkSuffix), path, corpus, linter, installed }) })),
  ...rulePaths(gateSuffix).map((path) => ({ rule: basename(path, gateSuffix), scan: () => scanGate({ path, corpus }) })),
];
const results = rules.filter(({ rule }) => !onlyRule || rule === onlyRule).map(measureRule);
console.log(
  asJson
    ? JSON.stringify(results, (key, value) => (key === 'bySource' ? undefined : value), 1)
    : results.map(describe).join('\n\n'),
);
process.exit(results.some((result) => result.unlabeled.length || result.stale.length) ? 1 : 0);
