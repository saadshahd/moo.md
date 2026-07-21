// model — what the registry's contents mean.
//
// Nodes, lineage, liveness, and leases. IDs are hierarchical (c1, c1.2,
// c1.2.1): owning a node is owning its subtree, so recursive decomposition
// needs no extra machinery.

import { now, STALE_S } from './store.mjs';

export const isLive = (n) => n.status === 'running' && now() - (n.heartbeat || 0) <= STALE_S;
export const liveClaims = (n) => (n.claims || []).filter(c => now() - c.at < c.ttl);
export const subtreeOf = (id, nodes) => Object.keys(nodes).filter(k => k === id || k.startsWith(id + '.'));
export const sameLineage = (a, b) => a.startsWith(b + '.') || b.startsWith(a + '.');

export function nextChildId(db, parent) {
  const mk = (i) => parent ? `${parent}.${i}` : `c${i}`;
  let i = 1; while (db.nodes[mk(i)]) i++;
  return mk(i);
}

// Glob conflict = literal-prefix containment. Deliberately over-approximate:
// leases are advisory, so a cheap false conflict beats a missed real one.
const prefix = (g) => g.split(/[*?[]/)[0].replace(/\/+$/, '');
export function overlaps(a, b) {
  const pa = prefix(a), pb = prefix(b);
  return pa === pb || pa.startsWith(pb + '/') || pb.startsWith(pa + '/') || pa === '' || pb === '';
}

// A conflict needs: another node, live, outside my lineage (a parent delegated
// scope to its child on purpose), holding an unexpired lease that overlaps.
export function conflictsFor(db, id, globs, mode) {
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

export const view = (n) => ({
  id: n.id, task: n.task, status: n.status, scopes: n.scopes, blockedBy: n.blockedBy, claims: liveClaims(n),
});
