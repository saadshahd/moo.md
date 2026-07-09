---
paths: "**/*.{ts,tsx}"
when: distributed
source: Lamport
---
when: [distributed] · tier: standard · check: judgeable
A handler never assumes messages arrive in send order. It carries the sender's sequence/version and ignores any update older than the state it already holds.
WRONG:
```ts
socket.on('cursor', (m) => { cursors[m.userId] = m.pos })
// an out-of-order packet snaps the cursor backwards
```
RIGHT:
```ts
socket.on('cursor', (m: { userId: string; pos: Pos; seq: number }) => {
  const cur = cursors[m.userId]
  if (cur && m.seq <= cur.seq) return          // stale — drop
  cursors[m.userId] = { pos: m.pos, seq: m.seq }
})
```
_Avoid_: applying a received update unconditionally; sorting an incoming stream by arrival index; assuming request N's response precedes request N+1's.
Detect: a subscription / stream / socket handler that writes received state without comparing an incoming monotonic field against what it holds.
Not-when: transport already guarantees per-key ordering end-to-end (a single ordered partition consumed by one consumer), and that guarantee is stated at the boundary.
