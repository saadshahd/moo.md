---
when: distributed
source: Lamport
topic: messaging
---
A handler never assumes messages arrive in send order. It carries the sender's sequence/version and ignores any update older than the state it already holds.
_Avoid_: applying a received update unconditionally; sorting an incoming stream by arrival index; assuming request N's response precedes request N+1's.
Detect: a subscription / stream / socket handler that writes received state without comparing an incoming monotonic field against what it holds.
Not-when: transport already guarantees per-key ordering end-to-end (a single ordered partition consumed by one consumer), and that guarantee is stated at the boundary.
