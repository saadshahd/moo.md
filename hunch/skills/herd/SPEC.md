# herd — design spec

Advisory coordination for concurrent agents: one queryable registry holding a task DAG with hierarchical ownership, plus TTL resource leases. This document records the design, its goals, and the evidence it rests on.

## Goals

Serves all four moo outcomes:

- **Reduce decision regret** — conflicts surface at claim time with a named owner, not at merge time as a corrupted diff.
- **Increase conceptual clarity** — `me` and `roster` give every agent (and the human) a live answer to *who am I, what do I own, what do the others own*.
- **Fewer but stronger artifacts** — allocation-first dispatch drives redundant work (two agents producing the same thing) toward zero.
- **Preserve ownership** — concurrency is capped at what the human can still audit; the verify-net checks claims, the handover stays human.

## Research grounding

Nakajima, *The Shared Discovery Paradox* (arXiv:2607.18045): pooling information improves individual answers but pooling **actions** destroys group outcomes — consensus discovery 0.38 vs planner-portfolio 0.86 in the canonical 16-box/8-searcher world. The design lessons herd encodes:

- **Allocation over locking.** The paper ranks proactive portfolio allocation (0.859) far above reactive market equilibrium (0.599). Herd's primary mechanism is disjoint decomposition at dispatch; leases are the safety net for imperfect decomposition, never the plan.
- **Pool information, never actions.** The registry centralizes evidence (who owns what, what's blocked); actions stay distributed and diverse.
- **Redundancy is the waste metric.** The paper's identity `N·Q − G = E[(K−1)⁺]` — expected redundant successes — is exactly what the DAG minimizes and the event log measures.
- **Research fan-out is the paradox's home turf.** Agents exploring one question must carry *distinct assigned angles*; converging on the pooled best guess is the 0.38 protocol.

## Evidence

### Monte-Carlo (24 tasks, 12 resources, 6 workers, hidden deps p=0.10, 500 trials)

| protocol | speedup vs sequential | wasted work |
| --- | --- | --- |
| naive parallel | 0.19× | 98.6% |
| advisory locks only | 0.71× | 93.5% |
| planner DAG only | 3.71× | 40.8% |
| hybrid (DAG + advisory leases) | **4.49×** | **25.4%** |

Compliance sweep: locks-only collapses below ~95% compliance (0.73× at 85%); hybrid degrades gracefully (4.52× at 85%, 3.50× at 0%) because allocation prevents most conflicts before etiquette matters. Worker frontier saturates at 4–6 agents — matching moo's attention-span anti-pattern from the throughput side.

### Live dry-run (3 real concurrent subagents, deliberate shared-file collision)

Zero lost updates on the contested file; the one engineered conflict was caught at claim time, honored without `--force`, and resolved by reordering; a child agent decomposed its own node (recursion held); ~2× wall-clock vs summed agent time. Single run — a demonstration, not a rate (see graduation criteria in HYPOTHESIS.md).

### Landscape (July 2026 survey)

No existing tool covers the combination. Beads (`bd`): best-in-class task DAG + atomic claims, no resource leases, no liveness. MCP Agent Mail: best-in-class glob+TTL leases + identity, server-shaped (HTTP-only), no DAG. Agent-MCP: all three but AGPL, heavyweight, linear chains. Soloterm: leases over MCP, closed-source desktop app. Nothing addresses subagent-scoped or recursive coordination.

## Design

- **One JSON registry + zero-dep Node CLI** over MCP server: any runner with a shell participates; nothing to install or keep alive. State is ephemeral by contract (`.herd/` is gitignored, deleted at wrap) — coordination state, not pipeline state.
- **Hierarchical IDs as ownership** (`h1.2.1` owns under `h1.2`): recursion costs nothing; same-lineage claims never conflict (a parent delegated that scope down).
- **Advisory leases with TTL + heartbeat liveness** over hard gates: fits hope's hook philosophy (observe, never gate); crashed agents expire instead of wedging. Compliance is a measured rate (`events.jsonl`), fenced by the deterministic verify-net (diff vs claim log), per CLAUDE.md's model-judgment-boundary rule.
- **Glob-prefix conflict detection**, over-approximate by intent: for advisory use, cheap false conflicts beat missed ones.
- **Identity by prompt/env (`HERD_ID`)** over self-registration: the parent mints the node and hands the child its name; "who am I" is answerable on the first tool call.

## Beads exit-ramp

If the hunch graduates beyond moo, migrate the DAG substrate to `bd` (verified in-container: atomic contested claims, depth-4 hierarchy, subtree-scoped ready-frontier, JSON everywhere) and keep only a thin lease sidecar cribbed from Agent Mail's reservation schema (`{agent, paths[], ttl, exclusive, reason}`). Not adopted now: 137 MB fast-churning binary, claims without expiry, parents claimable while children are open — wrong trade for a hunch that must stay throwaway-cheap.

## Open questions

- Naming is working-title; settled at graduation, not before.
- Standalone repo vs moo plugin at graduation — the runner-agnostic story eventually wants its own home.
- Whether delegate's SKILL.md gains a one-line "herd available → use it" pointer, or triggering stays with this skill's description alone.
