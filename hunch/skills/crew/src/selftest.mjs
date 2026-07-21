// selftest — the acceptance checks, runnable anywhere node runs.
//
// Exercises the real CLI as child processes against a throwaway registry:
// lock atomicity under racing writers, advisory refusal with a named owner,
// single-winner claim races, lineage exemption, TTL expiry, the ready
// frontier, and the claim log. `crew selftest` must pass on a machine before
// the tool is trusted with a run there.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { msleep } from './store.mjs';

export async function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-selftest-'));
  const env = { ...process.env, CREW_FILE: path.join(dir, 'registry.json') };
  delete env.CREW_ID;
  const entry = process.argv[1];
  const crew = (args, extra = {}) => new Promise((resolve) =>
    execFile(process.execPath, [entry, ...args], { env: { ...env, ...extra } },
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
