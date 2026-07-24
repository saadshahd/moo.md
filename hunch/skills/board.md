## Worker contract (embed in every brief)

The board is the shared surface the human already watches — tasks, claims, checkpoints, handoffs.

### Awareness

- On start, read the board: who else runs, what each claims, what's blocked. Your first board write records your session id (`$CLAUDE_CODE_SESSION_ID`) against your name — nobody asks a dying worker for it later.
- Claim your task mechanically (the binding's claim) before touching it. Never edit outside your claim; needing a file outside it → stop and report on the board.
- Peer-to-peer for anything mechanical: your completion unblocks a task → claim it yourself, wake the worker waiting on it, or spawn its owner — directly, never through the lead.
- Work you discover outside every lane (a bug, a gap, polish) → a ticket on the board for the steward, never a lane you invent or a message to the lead.
- Spawning your own sub-agent → carve it a narrower claim inside yours, name it in your handoff, and pass the model its lane names — mechanical work never defaults to the top tier.
- Completion notifies and handoff review go to the steward (the binding names it; no steward running → the lead). The lead is the human's pager: contact it only for ambiguity, a scope decision, blocked-on-human.
- The human's feedback surface is theirs alone: no agent ever sends input into it. Reaching the human = a board flag plus the lead paging them.
- Batch independent tool calls in one message — never one per turn.

### Handoff (durable, never terminal output alone)

- **Checkpoint** — your session id is on the board from your first write; once you've built context successors would want, add one line naming what it holds.
- **Terminal handoff** — before you finish: files changed, what you learned, what's undone — complete enough for a cold successor. It must be a deliverable you produce and verify yourself while running, never a gate only the lead opens.
- Watch your own gauge (the binding names it). Nearing compaction with the lane unfinished → write the terminal handoff now, then keep working: compaction eats what only your context holds.

### Context reuse (die freely, spawn fresh)

- No worker lingers "in case": transcripts survive death; the board and terminal handoffs are the knowledge transfer — successors cold-start from them by default.
- Fork a checkpoint only when all three hold: cache-warm (under ~1h old), light (under ~100k tokens), same lane's context. A stale or heavy fork re-ingests its whole transcript at full cost, and compaction can eat the successor's brief.
- Checkpoints are immutable: fork (`--resume <session-id> --fork-session`), never plain `--resume` (it appends to the original transcript; two resumers collide on one file). Never `--continue` (latest-in-directory is a race in a shared tree).
- Degradation: `$CLAUDE_CODE_SESSION_ID` unset → skip the checkpoint; a failed fork → cold start. Either way the terminal handoff carries the successor.
