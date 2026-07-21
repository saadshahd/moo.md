// commands — the registry below IS the documentation.
//
// Every command carries its usage, a one-line summary, and (where semantics
// need it) a detail block. `crew help` renders straight from this table, so
// behavior and documentation cannot drift apart.

import { FILE, ME, now, withLock, load, save, logEvent } from './store.mjs';
import { isLive, liveClaims, subtreeOf, sameLineage, nextChildId, conflictsFor, view } from './model.mjs';
import { selftest } from './selftest.mjs';

// cli plumbing
const print = (o) => process.stdout.write(JSON.stringify(o, null, 2) + '\n');
const die = (msg) => { console.error(msg); process.exit(2); };
const arg = (a, name, def) => { const i = a.indexOf(name); return i >= 0 ? a[i + 1] : def; };
const has = (a, name) => a.includes(name);
const multi = (a, name) => a.flatMap((f, i) => f === name ? [a[i + 1]] : []);
const positionals = (a) => a.filter((v, i) => !v.startsWith('--') && (i === 0 || !a[i - 1].startsWith('--')));
const idArg = (a, verb) => positionals(a)[0] || ME || die(`crew ${verb}: pass an id or set CREW_ID`);
const reqNode = (db, id) => db.nodes[id] || die(`no such node ${id}`);

function finish(a, status) {
  const id = idArg(a, status);
  withLock(() => {
    const db = load(); const n = reqNode(db, id);
    n.status = status; n.claims = []; n.note = arg(a, '--note', n.note);
    save(db);
  });
  print({ ok: true, id, status });
}

export const commands = {
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
Claiming marks you running. Every decision lands in events.jsonl beside the registry.`,
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
