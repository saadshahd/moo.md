#!/usr/bin/env node
// herd — minimal file-backed coordination registry for concurrent agents.
// Runner-agnostic: any process with shell access participates. Advisory only.
// State: one JSON file (HERD_FILE or ./.herd/registry.json). Ephemeral by design.

import fs from 'node:fs';
import path from 'node:path';

const FILE = process.env.HERD_FILE || path.join(process.cwd(), '.herd', 'registry.json');
const LOCKDIR = FILE + '.lock';
const STALE_S = Number(process.env.HERD_STALE_S || 120); // heartbeat liveness window
const now = () => Math.floor(Date.now() / 1000);

function withLock(fn) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const deadline = Date.now() + 5000;
  for (;;) {
    try { fs.mkdirSync(LOCKDIR); break; }
    catch {
      try { // steal locks abandoned by crashed holders
        if (Date.now() - fs.statSync(LOCKDIR).mtimeMs > 10_000) { fs.rmdirSync(LOCKDIR); continue; }
      } catch {}
      if (Date.now() > deadline) throw new Error('herd: lock timeout');
      msleep(25);
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(LOCKDIR); } catch {} }
}
function msleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { nodes: {} }; }
}
function save(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

// --- glob prefix heuristic: two claims conflict when either's literal prefix
// contains the other's. Deliberately over-approximate; advisory, so cheap FPs beat FNs.
const prefix = (g) => g.split(/[*?[]/)[0].replace(/\/+$/, '');
function overlaps(a, b) {
  const pa = prefix(a), pb = prefix(b);
  return pa === pb || pa.startsWith(pb + '/') || pb.startsWith(pa + '/') || pa === '' || pb === '';
}

const isLive = (n) => n.status === 'running' && now() - (n.heartbeat || 0) <= STALE_S;
const liveClaims = (n) => (n.claims || []).filter(c => now() - c.at <= c.ttl);
const subtreeOf = (id, nodes) => Object.keys(nodes).filter(k => k === id || k.startsWith(id + '.'));

function nextChildId(db, parent) {
  if (!parent) {
    let i = 1; while (db.nodes['h' + i]) i++; return 'h' + i;
  }
  let i = 1; while (db.nodes[`${parent}.${i}`]) i++; return `${parent}.${i}`;
}

function conflictsFor(db, id, globs, mode) {
  const out = [];
  for (const [oid, n] of Object.entries(db.nodes)) {
    if (oid === id || !isLive(n)) continue;
    if (id && (oid.startsWith(id + '.') || id.startsWith(oid + '.'))) continue; // same lineage: parent delegated scope to child
    for (const c of liveClaims(n)) {
      if (mode === 'shared' && c.mode === 'shared') continue;
      for (const g of globs) for (const cg of c.paths) {
        if (overlaps(g, cg)) out.push({ owner: oid, task: n.task, theirClaim: cg, yourGlob: g, mode: c.mode });
      }
    }
  }
  return out;
}

const print = (o) => process.stdout.write(JSON.stringify(o, null, 2) + '\n');
const arg = (flags, name, def) => { const i = flags.indexOf(name); return i >= 0 ? flags[i + 1] : def; };
const has = (flags, name) => flags.includes(name);
const multi = (flags, name) => flags.flatMap((f, i) => f === name ? [flags[i + 1]] : []);

const [, , cmd, ...rest] = process.argv;
const ME = process.env.HERD_ID;

switch (cmd) {
  case 'init':
    withLock(() => save({ nodes: {} }));
    print({ ok: true, file: FILE });
    break;

  case 'add': { // herd add "task" [--parent ID] [--scope G]... [--blocked-by a,b] [--status running]
    const task = rest[0];
    if (!task) die('usage: herd add "task" [--parent ID] [--scope glob]... [--blocked-by ids]');
    const id = withLock(() => {
      const db = load();
      const parent = arg(rest, '--parent', null);
      if (parent && !db.nodes[parent]) die(`no such parent ${parent}`);
      const nid = nextChildId(db, parent);
      db.nodes[nid] = {
        id: nid, parent, task, status: arg(rest, '--status', 'pending'),
        scopes: multi(rest, '--scope'),
        blockedBy: (arg(rest, '--blocked-by', '') || '').split(',').filter(Boolean),
        claims: [], created: now(), heartbeat: 0,
      };
      save(db); return nid;
    });
    print({ id });
    break;
  }

  case 'start': { // herd start [id] — announce running + heartbeat
    const id = rest[0] || ME || die('herd start <id> (or set HERD_ID)');
    withLock(() => { const db = load(); const n = req(db, id); n.status = 'running'; n.heartbeat = now(); save(db); });
    print({ ok: true, id });
    break;
  }

  case 'beat': {
    const id = rest[0] || ME || die('herd beat <id> (or set HERD_ID)');
    withLock(() => { const db = load(); const n = req(db, id); n.heartbeat = now(); save(db); });
    print({ ok: true });
    break;
  }

  case 'me': { // who am I, what do I own, what do other LIVE agents own that touches me
    const id = rest[0] || ME || die('herd me <id> (or set HERD_ID)');
    const db = load(); const n = req(db, id);
    const chain = []; for (let p = n.parent; p; p = db.nodes[p]?.parent) chain.unshift({ id: p, task: db.nodes[p]?.task });
    const mySubtree = subtreeOf(id, db.nodes).map(k => pick(db.nodes[k]));
    const others = Object.values(db.nodes).filter(o => isLive(o) && o.id !== id && !o.id.startsWith(id + '.'))
      .map(o => ({ id: o.id, task: o.task, scopes: o.scopes, claims: liveClaims(o).map(c => c.paths).flat() }));
    const watch = conflictsFor(db, id, [...(n.scopes || []), ...liveClaims(n).flatMap(c => c.paths)], 'excl');
    print({ you: pick(n), lineage: chain, yourSubtree: mySubtree, otherLiveAgents: others, potentialConflicts: watch });
    break;
  }

  case 'roster': { // live agents and everything they own
    const db = load();
    print(Object.values(db.nodes).filter(isLive).map(n => ({
      id: n.id, task: n.task, scopes: n.scopes, claims: liveClaims(n),
      subtree: subtreeOf(n.id, db.nodes).filter(k => k !== n.id),
    })));
    break;
  }

  case 'tree': {
    const db = load(); const root = rest[0];
    const ids = root ? subtreeOf(root, db.nodes) : Object.keys(db.nodes);
    for (const k of ids.sort()) {
      const n = db.nodes[k]; const depth = k.split('.').length - 1;
      const live = isLive(n) ? '●' : n.status === 'done' ? '✔' : n.status === 'failed' ? '✖' : '○';
      const blocked = (n.blockedBy || []).filter(b => db.nodes[b]?.status !== 'done');
      console.log(`${'  '.repeat(depth)}${live} ${k} [${n.status}${blocked.length ? ' ⧗' + blocked.join(',') : ''}] ${n.task}${n.scopes?.length ? '  ⟨' + n.scopes.join(' ') + '⟩' : ''}`);
    }
    break;
  }

  case 'ready': { // unblocked pending nodes, optionally under a subtree
    const db = load(); const under = arg(rest, '--under', null);
    const ids = under ? subtreeOf(under, db.nodes) : Object.keys(db.nodes);
    print(ids.map(k => db.nodes[k]).filter(n => n.status === 'pending' &&
      (n.blockedBy || []).every(b => db.nodes[b]?.status === 'done')).map(pick));
    break;
  }

  case 'claim': { // herd claim <glob>... [--id X] [--ttl s] [--shared] [--force]
    const globs = rest.filter(r => !r.startsWith('--') && r !== arg(rest, '--id') && r !== arg(rest, '--ttl'));
    const id = arg(rest, '--id', ME) || die('claim: set HERD_ID or pass --id');
    const ttl = Number(arg(rest, '--ttl', 900));
    const mode = has(rest, '--shared') ? 'shared' : 'excl';
    const res = withLock(() => {
      const db = load(); const n = req(db, id);
      const conflicts = conflictsFor(db, id, globs, mode);
      if (conflicts.length && !has(rest, '--force')) return { granted: false, conflicts };
      n.claims = [...liveClaims(n), { paths: globs, mode, ttl, at: now() }];
      n.heartbeat = now(); save(db);
      return { granted: true, forced: conflicts.length > 0, conflicts };
    });
    // event log: the measurable record of advisory compliance (forced = etiquette broken)
    fs.appendFileSync(path.join(path.dirname(FILE), 'events.jsonl'),
      JSON.stringify({ t: now(), id, globs, granted: res.granted, forced: !!res.forced }) + '\n');
    print(res);
    process.exit(res.granted ? 0 : 3); // 3 = advisory conflict; caller decides
  }

  case 'release': { // herd release [glob]... [--id X]  (no globs = release all)
    const globs = rest.filter(r => !r.startsWith('--') && r !== arg(rest, '--id'));
    const id = arg(rest, '--id', ME) || die('release: set HERD_ID or pass --id');
    withLock(() => {
      const db = load(); const n = req(db, id);
      n.claims = globs.length ? liveClaims(n).filter(c => !c.paths.some(p => globs.includes(p))) : [];
      save(db);
    });
    print({ ok: true });
    break;
  }

  case 'done': case 'fail': {
    const id = rest[0] || ME || die(`herd ${cmd} <id>`);
    withLock(() => {
      const db = load(); const n = req(db, id);
      n.status = cmd === 'done' ? 'done' : 'failed'; n.claims = []; n.note = arg(rest, '--note', n.note);
      save(db);
    });
    print({ ok: true, id, status: cmd === 'done' ? 'done' : 'failed' });
    break;
  }

  case 'block': { // herd block <id> --on <id2>
    const [id] = rest; const on = arg(rest, '--on') || die('herd block <id> --on <id2>');
    withLock(() => { const db = load(); const n = req(db, id); req(db, on);
      n.blockedBy = [...new Set([...(n.blockedBy || []), on])]; save(db); });
    print({ ok: true });
    break;
  }

  case 'json': print(load()); break;

  default:
    console.log(`herd — advisory coordination for concurrent agents (state: ${FILE})
  init                          create registry
  add "task" [--parent ID] [--scope G]... [--blocked-by a,b]   mint a node, prints id
  start|beat|done|fail [id]     lifecycle (id from HERD_ID if omitted)
  me [id]                       who am I / what do I own / who else is live / conflicts
  roster                        live agents + their claims and subtrees
  tree [id]                     render DAG
  ready [--under id]            unblocked pending work
  claim <glob>... [--ttl s] [--shared] [--force]   advisory lease (exit 3 on conflict)
  release [glob]...             drop leases
  block <id> --on <id2>         add dependency edge
  json                          dump raw registry`);
}

function req(db, id) { const n = db.nodes[id]; if (!n) die(`no such node ${id}`); return n; }
function pick(n) { return { id: n.id, task: n.task, status: n.status, scopes: n.scopes, blockedBy: n.blockedBy, claims: liveClaims(n) }; }
function die(msg) { console.error(msg); process.exit(2); }
