// store — where crew's state lives and how it's safely touched.
//
// One JSON registry plus an append-only claim log, in the OS temp dir keyed
// by project path: agents launched from the same directory share a registry,
// and no file ever lands in the project. CREW_FILE overrides the location.
// All mutation goes through withLock (mkdir lock, stealable when stale) and
// lands via atomic rename.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const projectKey = crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 8);

export const FILE = process.env.CREW_FILE || path.join(os.tmpdir(), `crew-${projectKey}`, 'registry.json');
export const EVENTS = path.join(path.dirname(FILE), 'events.jsonl');
export const STALE_S = Number(process.env.CREW_STALE_S || 120); // heartbeat liveness window
export const ME = process.env.CREW_ID;
export const now = () => Math.floor(Date.now() / 1000);
export const msleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const LOCKDIR = FILE + '.lock';

export function withLock(fn) {
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

export const load = () => {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { nodes: {} }; }
};

export function save(db) {
  const tmp = FILE + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

// Every claim decision is appended here — the measurable record of advisory
// compliance (a `forced: true` line is etiquette broken on purpose).
export const logEvent = (e) => fs.appendFileSync(EVENTS, JSON.stringify({ t: now(), ...e }) + '\n');
