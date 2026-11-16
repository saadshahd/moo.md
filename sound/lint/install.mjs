import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { caseFailures, caseList, lintCases, loadCheck } from './cases.mjs';
import { pluginSource } from './plugin.mjs';
import { coveringLinter, probeRepo } from './probe.mjs';
import { meetsFloor, runLint, tools } from './tools.mjs';
import { ManualWiring, wireEslint, wireOxlint } from './wire.mjs';

const installedRoot = '.claude/sound';
const pluginFile = `${installedRoot}/plugin.mjs`;
const trialDirectory = 'sound-trial';
const checkSuffix = '.check.mjs';
const localSuffix = '.local.check.mjs';
const wiringByTool = { oxlint: wireOxlint, eslint: wireEslint };

const specifierFrom = (from, to) => {
  const path = posix.relative(posix.dirname(from), to);
  return /^\.\.?\//.test(path) ? path : `./${path}`;
};

const binaryFor = ({ root, configDirectory, tool }) => {
  for (let directory = join(root, configDirectory); ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules/.bin', tool);
    if (existsSync(candidate)) return candidate;
    if (directory === root || directory === dirname(directory)) return null;
  }
};

const snapshot = ({ files, directories }) => {
  const before = files.map((path) => ({ path, text: existsSync(path) ? readFileSync(path) : undefined }));
  const absent = directories.filter((path) => !existsSync(path));
  return () => {
    before.forEach(({ path, text }) => (text === undefined ? rmSync(path, { force: true }) : writeFileSync(path, text)));
    absent.forEach((path) => rmSync(path, { recursive: true, force: true }));
  };
};

const rowKey = ({ file, ruleId, line, message }) => `${file}|${ruleId}|${line}|${message}`;
const outsideRules = (hits) => hits.filter((hit) => hit.ruleId && !hit.ruleId.startsWith('sound/'));

const trial = ({ tool, bin, root, config, cases }) => {
  const configDirectory = join(root, posix.dirname(config));
  const directory = join(configDirectory, trialDirectory);
  try {
    return lintCases({ tool, bin, directory, from: configDirectory, config: join(root, config), cases: caseList({ cases }) });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const trialOutcome = ({ cases, hitsByCase }) => {
  const invalidIds = new Set(caseList({ cases }).filter(({ expected }) => expected > 0).map(({ id }) => id));
  const entries = [...hitsByCase];
  const ruleSets = (rows) => rows.map(([, hits]) => new Set(outsideRules(hits).map((hit) => hit.ruleId)));
  const onEveryInvalid = ruleSets(entries.filter(([id]) => invalidIds.has(id))).reduce((common, set) => new Set([...common].filter((rule) => set.has(rule))));
  const onSomeValid = new Set(ruleSets(entries.filter(([id]) => !invalidIds.has(id))).flatMap((set) => [...set]));
  return {
    fatal: entries.flatMap(([, hits]) => hits).find((hit) => hit.severity === 'fatal'),
    coveredBy: [...onEveryInvalid].filter((rule) => !onSomeValid.has(rule)),
    clashes: [...onSomeValid].filter((rule) => !onEveryInvalid.has(rule)),
  };
};

const wholeLint = ({ tool, bin, root, config }) =>
  runLint({ tool, bin, cwd: join(root, posix.dirname(config)), config: join(root, config), files: ['.'] }).hits;

const severityFor = ({ type, repoHits }) => (type === 'problem' && repoHits === 0 ? 'error' : 'warn');

const checkPaths = ({ root, topic, rule }) => ({
  target: join(root, installedRoot, topic, `${rule}${checkSuffix}`),
  local: join(root, installedRoot, topic, `${rule}${localSuffix}`),
});

const resolveFile = ({ target, corpusText, resolution }) => {
  const theirs = existsSync(target) ? readFileSync(target, 'utf8') : undefined;
  if (theirs === undefined || theirs === corpusText) return { action: 'write' };
  return { theirs: { action: 'keep' }, corpus: { action: 'write' }, both: { action: 'split' } }[resolution] ?? { action: 'conflict' };
};

const placeChecks = ({ root, entries, resolutions }) =>
  entries.map((entry) => {
    const paths = checkPaths({ root, topic: entry.topic, rule: entry.rule });
    const corpusText = readFileSync(entry.corpusFile, 'utf8');
    const { action } = resolveFile({ target: paths.target, corpusText, resolution: resolutions[entry.rule] });
    if (action === 'conflict') return { entry, conflict: true };
    mkdirSync(dirname(paths.target), { recursive: true });
    if (action === 'split') renameSync(paths.target, paths.local);
    if (action !== 'keep') writeFileSync(paths.target, corpusText);
    return { entry };
  });

const olderVersionNote = ({ tool, version }) =>
  version && !meetsFloor({ tool, version: version.value })
    ? ` (${tool} ${version.value} from ${version.source} is older than ${tools[tool].floor}, the lowest version these checks are tested on)`
    : '';

const installGroup = async ({ root, linter, bin, entries, resolutions, write }) => {
  const { tool, config } = linter;
  const olderNote = olderVersionNote(linter);
  const configPath = join(root, config);
  const originalConfig = readFileSync(configPath, 'utf8');
  const rows = [];
  const loaded = [];

  for (const entry of entries) {
    const { cases, default: check } = await loadCheck(entry.corpusFile);
    const outcome = trialOutcome({ cases, hitsByCase: trial({ tool, bin, root, config, cases }) });
    if (outcome.fatal) rows.push({ rule: entry.rule, status: 'cannot-run', tool, config, note: `the repo's config cannot parse the check's cases: ${outcome.fatal.message}${olderNote}` });
    else if (outcome.coveredBy.length) rows.push({ rule: entry.rule, status: 'covered', tool, config, covered: outcome.coveredBy.map((ruleId) => ({ ruleId, file: config })) });
    else loaded.push({ ...entry, cases, type: check.meta.type, clashes: outcome.clashes });
  }
  if (!loaded.length) return rows;

  const baseline = new Set(outsideRules(wholeLint({ tool, bin, root, config })).map(rowKey));
  const restore = snapshot({
    files: [configPath, join(root, pluginFile), ...loaded.flatMap(({ topic, rule }) => Object.values(checkPaths({ root, topic, rule })))],
    directories: [join(root, installedRoot), join(root, '.claude')],
  });

  try {
    const placed = placeChecks({ root, entries: loaded, resolutions });
    rows.push(...placed.filter(({ conflict }) => conflict).map(({ entry }) => ({ rule: entry.rule, status: 'conflict', tool, config, note: 'the installed check differs from the corpus copy: resolve as theirs, corpus or both' })));
    const active = placed.filter(({ conflict }) => !conflict).map(({ entry }) => entry);
    if (!active.length) return rows;

    writeFileSync(join(root, pluginFile), pluginSource(active.map(({ rule, topic }) => ({ rule, specifier: `./${topic}/${rule}${checkSuffix}` }))));
    const pluginSpecifier = specifierFrom(config, pluginFile);
    const wire = (severities) => wiringByTool[tool]({ text: originalConfig, root, pluginSpecifier, severities });

    writeFileSync(configPath, wire(Object.fromEntries(active.map(({ rule }) => [`sound/${rule}`, 'warn']))));
    const counted = wholeLint({ tool, bin, root, config });
    const hitsOf = (rule) => counted.filter((hit) => hit.ruleId === `sound/${rule}`).length;
    const severities = Object.fromEntries(active.map(({ rule, type }) => [`sound/${rule}`, severityFor({ type, repoHits: hitsOf(rule) })]));
    writeFileSync(configPath, wire(severities));

    const after = wholeLint({ tool, bin, root, config });
    const newFailure = outsideRules(after).find((hit) => !baseline.has(rowKey(hit)));
    if (newFailure) throw new Error(`wiring added a lint failure: ${rowKey(newFailure)}`);
    for (const entry of active) {
      const failures = caseFailures({ rule: entry.rule, cases: caseList({ cases: entry.cases }), hitsByCase: trial({ tool, bin, root, config, cases: entry.cases }) });
      if (failures.length) throw new Error(`${entry.rule} does not fire through the repo's config: ${failures[0]}`);
    }
    rows.push(...active.map((entry) => ({ rule: entry.rule, status: write ? 'installed' : 'would-install', tool, config, severity: severities[`sound/${entry.rule}`], repoHits: hitsOf(entry.rule), clashes: entry.clashes })));
    if (!write) restore();
    return rows;
  } catch (error) {
    restore();
    const manual = error instanceof ManualWiring;
    const note = manual ? `${error.message}; add by hand:\n${error.snippet}` : `${error.message}${olderNote}`;
    const unrowed = loaded.filter(({ rule }) => !rows.some((row) => row.rule === rule));
    return [...rows, ...unrowed.map(({ rule }) => ({ rule, status: manual ? 'manual' : 'reverted', tool, config, note }))];
  }
};

export const installChecks = async ({ root, corpus, selected, resolutions = {}, write = false }) => {
  const probe = probeRepo(root);
  const rows = [];
  const groups = new Map();

  for (const { rule, topic, cite } of selected) {
    const corpusFile = join(corpus, topic, `${rule}${checkSuffix}`);
    if (!existsSync(corpusFile)) continue;
    const linter = coveringLinter(probe, cite);
    if (!linter) {
      const why = probe.unsupported.map(({ tool, reason }) => `${tool}: ${reason}`).join('; ') || 'no linter config found';
      rows.push({ rule, status: 'no-linter', note: `no supported lint config covers ${cite} (${why})` });
      continue;
    }
    groups.set(linter.config, { linter, entries: [...(groups.get(linter.config)?.entries ?? []), { rule, topic, corpusFile }] });
  }

  for (const { linter, entries } of groups.values()) {
    const configDirectory = posix.dirname(linter.config) === '.' ? '' : posix.dirname(linter.config);
    const bin = binaryFor({ root, configDirectory, tool: linter.tool });
    if (!bin) {
      rows.push(...entries.map(({ rule }) => ({ rule, status: 'no-linter', tool: linter.tool, config: linter.config, note: `${linter.tool} is not installed in the repo; install its dependencies first` })));
      continue;
    }
    rows.push(...(await installGroup({ root, linter: linter, bin, entries, resolutions, write })));
  }
  return rows;
};
