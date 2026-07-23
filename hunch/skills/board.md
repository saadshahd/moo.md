## Worker contract (embed in every brief)

The board is the shared surface the human already watches — tasks, claims, checkpoints, handoffs.

### Awareness

- On start, read the board: who else runs, what each claims, what's blocked.
- Claim your task mechanically (the binding's claim) before touching it. Never edit outside your claim; needing a file outside it → stop and report on the board.
- Peer-to-peer for anything mechanical: your completion unblocks a task → claim it yourself, wake the worker waiting on it, or spawn/fork its owner — directly, never through the lead.
- Spawning your own sub-agent → carve it a narrower claim inside yours and name it in your handoff; ownership stays traceable through you.
- The lead is the human's pager. Contact it only for what needs the human: ambiguity, a scope decision, integration ready for review, blocked-on-human.
- Batch independent tool calls in one message — never one per turn.

### Handoff (durable, never terminal output alone)

- **Checkpoint** — when you've built context successors will want (exploration done, before task-specific work): write your session id (`$CLAUDE_CODE_SESSION_ID`) plus one line naming what the context holds to the board.
- **Terminal handoff** — before you finish: files changed, what you learned, what's undone — complete enough for a cold successor. It must be a deliverable you produce and verify yourself while running, never a gate only the lead opens.

### Context reuse (die freely, fork precisely)

- No worker lingers "in case": transcripts survive death; the checkpoint is the reuse mechanism.
- Need a checkpoint's context? Fork it: launch the successor through the binding's spawn mechanism with `--resume <session-id> --fork-session`.
- Checkpoints are immutable: fork, never plain `--resume` (it appends to the original transcript; two resumers collide on one file). Never `--continue` (latest-in-directory is a race in a shared tree).
- Degradation: `$CLAUDE_CODE_SESSION_ID` unset → skip the checkpoint; a failed fork → cold start. Either way the terminal handoff carries the successor.
