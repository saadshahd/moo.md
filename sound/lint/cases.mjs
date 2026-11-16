import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runLint } from './tools.mjs';

const defaultFilename = 'case.ts';

export const loadCheck = (checkPath) => import(pathToFileURL(checkPath).href);

export const caseList = ({ cases }) => [
  ...cases.valid.map((entry, index) => ({ ...entry, id: `valid-${index}`, expected: 0 })),
  ...cases.invalid.map((entry, index) => ({ ...entry, id: `invalid-${index}`, expected: entry.errors })),
];

export const lintCases = ({ tool, bin, directory, from = directory, config, cases }) => {
  mkdirSync(directory, { recursive: true });
  const files = cases.map(({ id, filename }) => join(id, filename ?? defaultFilename));
  files.forEach((file, index) => {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    writeFileSync(join(directory, file), cases[index].code);
  });
  const { hits } = runLint({ tool, bin, cwd: from, config, files: files.map((file) => relative(from, join(directory, file))) });
  const unattributed = hits.find((hit) => !hit.file);
  if (unattributed) throw new Error(`${tool} reported an error outside any case file: ${unattributed.message}`);
  return new Map(cases.map(({ id }, index) => [id, hits.filter((hit) => hit.file === relative(from, join(directory, files[index])))]));
};

export const caseFailures = ({ rule, cases, hitsByCase }) =>
  cases.flatMap(({ id, code, expected }) => {
    const hits = hitsByCase.get(id);
    const crashed = hits.filter((hit) => hit.severity === 'fatal');
    const got = hits.filter((hit) => hit.ruleId === `sound/${rule}`).length;
    if (crashed.length) return [`${id}: parse failure: ${crashed[0].message}`];
    return got === expected ? [] : [`${id}: expected ${expected} hit(s), got ${got}: ${code}`];
  });
