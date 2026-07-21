#!/usr/bin/env node
// Trial harness: deterministic parts only (copy, freeze-check, record).
// Agent spawning/reaping is driven by the orchestrator over MCP, not here.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, cpSync, appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LAB = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(LAB, 'fixture');
const RESULTS = join(LAB, 'results.jsonl');
const FROZEN = ['tests', 'src/registry.js', 'src/app.js']; // the oracle + infra; agents must not touch
const die = m => { console.error('ERROR: ' + m); process.exit(2); };

// Single source of truth for "did an agent tamper with the frozen oracle/infra".
function frozenDiff(dir) {
  try {
    const c = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...FROZEN], { cwd: dir, encoding: 'utf8' }).trim();
    return c ? { frozen_ok: false, tampered: c.split('\n') } : { frozen_ok: true, tampered: [] };
  } catch (e) { return { frozen_ok: false, tampered: ['freezecheck-error:' + e.message] }; }
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'setup') {
  const [trialId, arm] = rest;
  if (!trialId || !arm) die('usage: setup <trialId> <arm>');
  const dir = join(LAB, `run-${trialId}-${arm}`);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  cpSync(FIXTURE, dir, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=h@x', '-c', 'user.name=h', 'commit', '-qm', 'baseline'], { cwd: dir });
  const hash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  console.log(JSON.stringify({ dir, baseline: hash }));
  process.exit(0);
}

if (cmd === 'freezecheck') {
  const [dir] = rest;
  if (!dir || !existsSync(dir)) die('usage: freezecheck <dir>');
  const r = frozenDiff(dir);
  console.log(JSON.stringify(r.frozen_ok ? { frozen_ok: true } : r));
  process.exit(r.frozen_ok ? 0 : 1);
}

if (cmd === 'record') {
  const [trialId, arm, dir, wallMsS] = rest;
  if (!trialId || !arm || !dir || wallMsS == null) die('usage: record <trialId> <arm> <dir> <wallMs>');
  // freeze integrity first — a tampered oracle voids the trial.
  const { frozen_ok, tampered } = frozenDiff(dir);
  const metrics = JSON.parse(execFileSync('node', [join(LAB, 'measure.mjs'), dir], { encoding: 'utf8' }).trim());
  const row = { trialId, arm, wallMs: Number(wallMsS), frozen_ok, tampered, valid: frozen_ok && !metrics.probeError, ...metrics };
  appendFileSync(RESULTS, JSON.stringify(row) + '\n');
  console.log(JSON.stringify(row));
  process.exit(row.valid ? 0 : 1);
}

if (cmd === 'summary') {
  if (!existsSync(RESULTS)) { console.log('no results yet'); process.exit(0); }
  const rows = readFileSync(RESULTS, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

die(`unknown command '${cmd}'. commands: setup | freezecheck | record | summary`);
