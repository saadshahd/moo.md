#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceFile = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const manifestFile = /(?:^|\/)package\.json$/;
const declarationFile = /\.d\.[cm]?ts$|\.min\.js$/;
const prunedSegments = new Set(['node_modules', 'dist', 'build', '.next', 'vendor', 'worktrees', '.worktrees']);
const archiveLimit = 1 << 30;

const snapshotName = ({ name, rev }) => `${name}@${rev.slice(0, 7)}`;

const isKept = (path, exclude = []) =>
  (sourceFile.test(path) || manifestFile.test(path)) &&
  !declarationFile.test(path) &&
  !path.split('/').some((segment) => prunedSegments.has(segment)) &&
  !exclude.some((part) => path.includes(part));

const repositoryOf = ({ path, url, name }, cloneRoot) => {
  if (path) return path;
  const clone = join(cloneRoot, name);
  if (!existsSync(clone)) execFileSync('git', ['clone', '--quiet', url, clone], { stdio: 'inherit' });
  return clone;
};

const extractArchive = ({ repository, rev, subdir }, directory) => {
  const archive = execFileSync('git', ['-C', repository, 'archive', '--format=tar', rev, ...(subdir ? [subdir] : [])], {
    maxBuffer: archiveLimit,
  });
  const untar = spawnSync('tar', ['-x', '-C', directory], { input: archive });
  if (untar.status !== 0) throw new Error(`tar failed for ${directory}: ${untar.stderr}`);
};

const pruneTo = (directory, exclude) => {
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    const relative = path.slice(directory.length + 1);
    if (entry.isFile() && !isKept(relative, exclude)) rmSync(path);
  }
};

export const snapshot = (source, corpus, cloneRoot) => {
  const directory = join(corpus, snapshotName(source));
  if (existsSync(join(directory, '.sha'))) return directory;
  mkdirSync(directory, { recursive: true });
  extractArchive({ repository: repositoryOf(source, cloneRoot), rev: source.rev, subdir: source.subdir }, directory);
  pruneTo(directory, source.exclude);
  writeFileSync(join(directory, '.sha'), source.rev);
  return directory;
};

export const snapshotAll = (corpus) => {
  const { sources } = JSON.parse(readFileSync(join(here, 'sources.json'), 'utf8'));
  mkdirSync(corpus, { recursive: true });
  const cloneRoot = join(corpus, '.clones');
  mkdirSync(cloneRoot, { recursive: true });
  return sources.flatMap((source) => {
    try {
      return [snapshot(source, corpus, cloneRoot)];
    } catch (error) {
      console.error(`SKIP ${snapshotName(source)}: ${error.message.split('\n')[0]}`);
      return [];
    }
  });
};

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const corpus = resolve(process.argv[2] ?? '');
  if (!process.argv[2]) throw new Error('usage: node snapshot.mjs <corpus-directory>');
  const made = snapshotAll(corpus);
  console.log(`${made.length} snapshots in ${corpus}`);
}
