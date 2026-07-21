#!/usr/bin/env node
// crew — advisory coordination for concurrent agents.
//
// One JSON registry: a task tree with hierarchical ownership, advisory TTL
// leases on path globs, and heartbeat liveness. Runner-agnostic: any process
// with shell access participates; identity arrives via the CREW_ID env var.
//
// This file is the single source of truth for what crew does:
//   `crew help`            command overview
//   `crew help <command>`  full detail for one command
//   `crew selftest`        prove the tool works on this machine

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

// ── configuration ────────────────────────────────────────────────────────────
// State defaults to the OS temp dir, keyed by project path: agents launched in
// the same directory share a registry, and no file ever lands in the project.

const projectKey = crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 8);
const FILE = process.env.CREW_FILE || path.join(os.tmpdir(), `crew-${projectKey}`, 'registry.json');
const EVENTS = path.join(path.dirname(FILE), 'events.jsonl');
const LOCKDIR = FILE + '.lock';
const STALE_S = Number(process.env.CREW_STALE_S || 120); // heartbeat liveness window
const ME = process.env.CREW_ID;
const now = () => Math.floor(Date.now() / 1000);

// ── storage: mkdir-lock around read-modify-write, atomic rename on save ──────

function withLock(fn) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const deadline = Date.now() + 5000;
  for (;;) {
    try { fs.mkdirSync(LOCKDIR); break; }
    catch {
      try { // steal locks abandoned by crashed holders
        if (Date.now() - fs.statSync(LOCKDIR).mtimeMs > 10_000) { fs.rmdirSync(LOCKDIR); continue; }
      } catch {}
      if (Date.now() > deadline) throw new Error('crew: lock timeout');
      msleep(25);
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(LOCKDIR); } catch {} }
}
const msleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { nodes: {} }; } };
function save(db) {
  const tmp = FILE + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}
// Every claim decision is appended here — the measurable record of advisory
// compliance (a `forced: true` line is etiquette broken on purpose).
const logEvent = (e) => fs.appendFileSync(EVENTS, JSON.stringify({ t: now(), ...e }) + '\n');

// ── model: nodes, lineage, liveness, leases ──────────────────────────────────
// IDs are hierarchical (c1, c1.2, c1.2.1): owning a node is owning its subtree,
// so recursive decomposition needs no extra machinery.

const isLive = (n) => n.status === 'running' && now() - (n.heartbeat || 0) <= STALE_S;
const liveClaims = (n) => (n.claims || []).filter(c => now() - c.at < c.ttl);
const subtreeOf = (id, nodes) => Object.keys(nodes).filter(k => k === id || k.startsWith(id + '.'));
const sameLineage = (a, b) => a.startsWith(b + '.') || b.startsWith(a + '.');

function nextChildId(db, parent) {
  const base = parent ? parent + '.' : 'c';
  let i = 1; while (db.nodes[base === 'c' ? 'c' + i : base + i]) i++;
  return base === 'c' ? 'c' + i : base + i;
}

// Glob conflict = literal-prefix containment. Deliberately over-approximate:
// leases are advisory, so a cheap false conflict beats a missed real one.
const prefix = (g) => g.split(/[*?[]/)[0].replace(/\/+$/, '');
function overlaps(a, b) {
  const pa = prefix(a), pb = prefix(b);
  return pa === pb || pa.startsWith(pb + '/') || pb.startsWith(pa + '/') || pa === '' || pb === '';
}

// A conflict needs: another node, live, outside my lineage (a parent delegated
// scope to its child on purpose), holding an unexpired lease that overlaps.
function conflictsFor(db, id, globs, mode) {
  const out = [];
  for (const [oid, n] of Object.entries(db.nodes)) {
    if (oid === id || !isLive(n) || (id && sameLineage(oid, id))) continue;
    for (const c of liveClaims(n)) {
      if (mode === 'shared' && c.mode === 'shared') continue;
      for (const g of globs) for (const cg of c.paths) {
        if (overlaps(g, cg)) out.push({ owner: oid, task: n.task, theirClaim: cg, yourGlob: g, mode: c.mode });
      }
    }
  }
  return out;
}

const view = (n) => ({ id: n.id, task: n.task, status: n.status, scopes: n.scopes, blockedBy: n.blockedBy, claims: liveClaims(n) });
const reqNode = (db, id) => db.nodes[id] || die(`no such node ${id}`);

// ── cli plumbing ─────────────────────────────────────────────────────────────

const print = (o) => process.stdout.write(JSON.stringify(o, null, 2) + '\n');
const die = (msg) => { console.error(msg); process.exit(2); };
const arg = (a, name, def) => { const i = a.indexOf(name); return i >= 0 ? a[i + 1] : def; };
const has = (a, name) => a.includes(name);
const multi = (a, name) => a.flatMap((f, i) => f === name ? [a[i + 1]] : []);
const positionals = (a) => a.filter((v, i) => !v.startsWith('--') && (i === 0 || !a[i - 1].startsWith('--')));
const idArg = (a, verb) => positionals(a)[0] || ME || die(`crew ${verb}: pass an id or set CREW_ID`);

// ── commands: the registry below IS the documentation ────────────────────────

const commands = {
  add: {
    usage: 'crew add "task" [--parent ID] [--scope GLOB]... [--blocked-by ID,ID] [--status running]',
    summary: 'Mint a node (prints its id). With --parent, the node lives in that subtree.',
    detail: `Scopes declare intended territory (used for conflict warnings, not enforcement).
Blocked-by edges hold a node out of \`ready\` until the named nodes are done.
Any agent may add children under its own id — that is recursive decomposition.`,
    run(a) {
      const task = positionals(a)[0] || die(this.usage);
      const id = withLock(() => {
        const db = load();
        const parent = arg(a, '--parent', null);
        if (parent) reqNode(db, parent);
        const nid = nextChildId(db, parent);
        db.nodes[nid] = {
          id: nid, parent, task, status: arg(a, '--status', 'pending'),
          scopes: multi(a, '--scope'),
          blockedBy: (arg(a, '--blocked-by', '') || '').split(',').filter(Boolean),
          claims: [], created: now(), heartbeat: 0,
        };
        save(db); return nid;
      });
      print({ id });
    },
  },

  start: {
    usage: 'crew start [ID]',
    summary: 'Announce yourself running (sets status + heartbeat). First call on entry.',
    run(a) {
      const id = idArg(a, 'start');
      withLock(() => { const db = load(); const n = reqNode(db, id); n.status = 'running'; n.heartbeat = now(); save(db); });
      print({ ok: true, id });
    },
  },

  beat: {
    usage: 'crew beat [ID]',
    summary: 'Refresh your heartbeat. An agent silent longer than the stale window drops off the roster.',
    run(a) {
      const id = idArg(a, 'beat');
      withLock(() => { const db = load(); reqNode(db, id).heartbeat = now(); save(db); });
      print({ ok: true });
    },
  },

  me: {
    usage: 'crew me [ID]',
    summary: 'Who am I: your node, lineage, subtree, other live agents, and potential conflicts.',
    detail: `potentialConflicts compares YOUR scopes+leases against other live agents' leases —
check it on entry and before broadening your territory.`,
    run(a) {
      const id = idArg(a, 'me');
      const db = load(); const n = reqNode(db, id);
      const lineage = []; for (let p = n.parent; p; p = db.nodes[p]?.parent) lineage.unshift({ id: p, task: db.nodes[p]?.task });
      const others = Object.values(db.nodes)
        .filter(o => isLive(o) && o.id !== id && !sameLineage(o.id, id))
        .map(o => ({ id: o.id, task: o.task, scopes: o.scopes, claims: liveClaims(o).flatMap(c => c.paths) }));
      print({
        you: view(n), lineage,
        yourSubtree: subtreeOf(id, db.nodes).map(k => view(db.nodes[k])),
        otherLiveAgents: others,
        potentialConflicts: conflictsFor(db, id, [...(n.scopes || []), ...liveClaims(n).flatMap(c => c.paths)], 'excl'),
      });
    },
  },

  roster: {
    usage: 'crew roster',
    summary: 'Every live agent with its task, scopes, leases, and subtree.',
    run() {
      const db = load();
      print(Object.values(db.nodes).filter(isLive).map(n => ({
        id: n.id, task: n.task, scopes: n.scopes, claims: liveClaims(n),
        subtree: subtreeOf(n.id, db.nodes).filter(k => k !== n.id),
      })));
    },
  },

  tree: {
    usage: 'crew tree [ID]',
    summary: 'Render the task tree (or one subtree). ●running ✔done ✖failed ○pending ⧗blocked.',
    run(a) {
      const db = load(); const root = positionals(a)[0];
      for (const k of (root ? subtreeOf(root, db.nodes) : Object.keys(db.nodes)).sort()) {
        const n = db.nodes[k];
        const mark = isLive(n) ? '●' : n.status === 'done' ? '✔' : n.status === 'failed' ? '✖' : '○';
        const blocked = (n.blockedBy || []).filter(b => db.nodes[b]?.status !== 'done');
        console.log(`${'  '.repeat(k.split('.').length - 1)}${mark} ${k} [${n.status}${blocked.length ? ' ⧗' + blocked.join(',') : ''}] ${n.task}${n.scopes?.length ? '  ⟨' + n.scopes.join(' ') + '⟩' : ''}`);
      }
    },
  },

  ready: {
    usage: 'crew ready [--under ID]',
    summary: 'Pending nodes whose blocked-by edges have all cleared — the dispatchable frontier.',
    run(a) {
      const db = load(); const under = arg(a, '--under', null);
      print((under ? subtreeOf(under, db.nodes) : Object.keys(db.nodes))
        .map(k => db.nodes[k])
        .filter(n => n.status === 'pending' && (n.blockedBy || []).every(b => db.nodes[b]?.status === 'done'))
        .map(view));
    },
  },

  claim: {
    usage: 'crew claim GLOB... [--id ID] [--ttl SECONDS] [--shared] [--force]',
    summary: 'Take an advisory lease before editing. Exit 3 + owner details on conflict — you decide.',
    detail: `Leases expire after --ttl (default 900s). Conflicts never block: the JSON names the
owner and their lease so you can reorder your own work; --force records that you
proceeded anyway (logged, and a verify pass should treat it as a violation).
Same-lineage leases never conflict — a parent delegated that territory deliberately.
Shared leases (--shared) coexist with each other but not with exclusive ones.
Every decision is appended to events.jsonl beside the registry.`,
    run(a) {
      const flagVals = new Set([arg(a, '--id'), arg(a, '--ttl')]);
      const globs = a.filter(v => !v.startsWith('--') && !flagVals.has(v));
      if (!globs.length) die(this.usage);
      const id = arg(a, '--id', ME) || die('crew claim: pass --id or set CREW_ID');
      const mode = has(a, '--shared') ? 'shared' : 'excl';
      const res = withLock(() => {
        const db = load(); const n = reqNode(db, id);
        const conflicts = conflictsFor(db, id, globs, mode);
        if (conflicts.length && !has(a, '--force')) return { granted: false, conflicts };
        n.claims = [...liveClaims(n), { paths: globs, mode, ttl: Number(arg(a, '--ttl', 900)), at: now() }];
        n.heartbeat = now();
        if (n.status === 'pending') n.status = 'running'; // claiming means working
        save(db);
        return { granted: true, forced: conflicts.length > 0, conflicts };
      });
      logEvent({ id, globs, granted: res.granted, forced: !!res.forced });
      print(res);
      process.exit(res.granted ? 0 : 3);
    },
  },

  release: {
    usage: 'crew release [GLOB]... [--id ID]',
    summary: 'Drop leases the moment an edit lands. No globs = drop all yours.',
    run(a) {
      const flagVals = new Set([arg(a, '--id')]);
      const globs = a.filter(v => !v.startsWith('--') && !flagVals.has(v));
      const id = arg(a, '--id', ME) || die('crew release: pass --id or set CREW_ID');
      withLock(() => {
        const db = load(); const n = reqNode(db, id);
        n.claims = globs.length ? liveClaims(n).filter(c => !c.paths.some(p => globs.includes(p))) : [];
        save(db);
      });
      print({ ok: true });
    },
  },

  done: {
    usage: 'crew done [ID] [--note TEXT]',
    summary: 'Mark a node finished; its leases drop and nodes it blocked become ready.',
    run(a) { finish(a, 'done'); },
  },

  fail: {
    usage: 'crew fail [ID] [--note TEXT]',
    summary: 'Mark a node failed; leases drop, blocked-by edges on it stay unmet.',
    run(a) { finish(a, 'failed'); },
  },

  block: {
    usage: 'crew block ID --on ID',
    summary: 'Add a dependency edge after the fact (discovered mid-flight).',
    run(a) {
      const id = positionals(a)[0]; const on = arg(a, '--on') || die(this.usage);
      withLock(() => {
        const db = load(); const n = reqNode(db, id); reqNode(db, on);
        n.blockedBy = [...new Set([...(n.blockedBy || []), on])]; save(db);
      });
      print({ ok: true });
    },
  },

  json: {
    usage: 'crew json',
    summary: 'Dump the raw registry (also: events.jsonl beside it holds the claim log).',
    run() { print(load()); },
  },

  init: {
    usage: 'crew init',
    summary: 'Create an empty registry (also happens implicitly on first add).',
    run() { withLock(() => save({ nodes: {} })); print({ ok: true, file: FILE }); },
  },

  selftest: {
    usage: 'crew selftest',
    summary: 'Run the built-in acceptance checks in a throwaway registry.',
    run: () => selftest(),
  },

  help: {
    usage: 'crew help [COMMAND]',
    summary: 'This overview, or full detail for one command.',
    run(a) {
      const c = positionals(a)[0];
      if (c && commands[c]) {
        const cmd = commands[c];
        console.log(`${cmd.usage}\n\n${cmd.summary}${cmd.detail ? '\n\n' + cmd.detail : ''}`);
      } else {
        console.log(`crew — advisory coordination for concurrent agents\nregistry: ${FILE}\nidentity: CREW_ID env var (minted by whoever spawned you, via \`crew add\`)\n`);
        for (const [name, cmd] of Object.entries(commands)) console.log(`  ${name.padEnd(9)} ${cmd.summary}`);
        console.log(`\n\`crew help <command>\` for usage and detail.`);
      }
    },
  },
};

function finish(a, status) {
  const id = idArg(a, status);
  withLock(() => {
    const db = load(); const n = reqNode(db, id);
    n.status = status; n.claims = []; n.note = arg(a, '--note', n.note);
    save(db);
  });
  print({ ok: true, id, status });
}

// ── selftest: the acceptance checks, runnable anywhere node runs ─────────────

async function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-selftest-'));
  const env = { ...process.env, CREW_FILE: path.join(dir, 'registry.json') };
  delete env.CREW_ID;
  const self = process.argv[1];
  const crew = (args, extra = {}) => new Promise((resolve) =>
    execFile(process.execPath, [self, ...args], { env: { ...env, ...extra } },
      (err, stdout) => resolve({ code: err?.code || 0, out: stdout.trim() })));
  const j = (r) => { try { return JSON.parse(r.out); } catch { return {}; } };
  let failures = 0;
  const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures++; };

  await crew(['init']);
  const root = j(await crew(['add', 'root'])).id;

  // concurrent adds: no lost updates under the mkdir lock
  const adds = await Promise.all(Array.from({ length: 12 }, () => crew(['add', 'child', '--parent', root])));
  const ids = new Set(adds.map(r => j(r).id));
  check('12 racing adds yield 12 distinct ids', ids.size === 12);

  const [a, b] = [...ids];
  await crew(['start'], { CREW_ID: a });
  await crew(['start'], { CREW_ID: b });

  // exclusive lease then conflicting claim: advisory refusal with named owner
  const g1 = await crew(['claim', 'src/**'], { CREW_ID: a });
  const g2 = await crew(['claim', 'src/api/x.js'], { CREW_ID: b });
  check('first exclusive lease granted', g1.code === 0 && j(g1).granted);
  check('overlapping claim refused with exit 3 + owner', g2.code === 3 && j(g2).conflicts?.[0]?.owner === a);

  // racing claims on one resource: exactly one winner
  const race = await Promise.all([...ids].slice(2, 7).map(id => crew(['claim', 'race/**'], { CREW_ID: id })));
  check('5 racing claims on one glob grant exactly 1', race.filter(r => r.code === 0).length === 1);

  // lineage exemption: a child claims inside territory its parent leased
  const kid = j(await crew(['add', 'sub', '--parent', a])).id;
  await crew(['start'], { CREW_ID: kid });
  const g3 = await crew(['claim', 'src/lib/**'], { CREW_ID: kid });
  check('child claims inside parent lease without conflict', g3.code === 0 && j(g3).granted);

  // ttl expiry: a 1-second lease stops conflicting after it lapses
  await crew(['claim', 'tmp/**', '--ttl', '1'], { CREW_ID: a });
  msleep(1400);
  const g4 = await crew(['claim', 'tmp/**'], { CREW_ID: b });
  check('expired lease no longer conflicts', g4.code === 0 && j(g4).granted);

  // blocked-by: ready frontier respects edges until done clears them
  const t1 = j(await crew(['add', 'first', '--parent', root])).id;
  const t2 = j(await crew(['add', 'second', '--parent', root, '--blocked-by', t1])).id;
  const readyBefore = j(await crew(['ready'])).some(n => n.id === t2);
  await crew(['done', t1]);
  const readyAfter = j(await crew(['ready'])).some(n => n.id === t2);
  check('blocked node hidden from ready until dependency done', !readyBefore && readyAfter);

  // events log records refusals and grants
  const events = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  check('claim log recorded grants and refusals', events.some(e => e.granted) && events.some(e => !e.granted));

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

// ── entry ────────────────────────────────────────────────────────────────────

const [, , name, ...rest] = process.argv;
const cmd = commands[name || 'help'] || commands.help;
await cmd.run(rest);
