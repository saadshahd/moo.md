# crew — design spec

Advisory coordination for concurrent agents: one queryable registry holding a task tree with hierarchical ownership, plus TTL resource leases. This document records the design rationale and the evidence it rests on. What the tool *does* lives in `crew.mjs` itself (`crew help`, `crew selftest`) — never here.

## Goals

Serves all four moo outcomes:

- **Reduce decision regret** — conflicts surface at claim time with a named owner, not at merge time as a corrupted diff.
- **Increase conceptual clarity** — every agent (and the human) has a live answer to *who am I, what do I own, what do the others own*.
- **Fewer but stronger artifacts** — allocation-first dispatch drives redundant work (two agents producing the same thing) toward zero.
- **Preserve ownership** — concurrency stays within what the human can audit; a verify-net checks the claim log after the fact.

## Research grounding

Nakajima, *The Shared Discovery Paradox* (arXiv:2607.18045): pooling information improves individual answers but pooling **actions** destroys group outcomes — consensus discovery 0.38 vs planner-portfolio 0.86 in the canonical 16-box/8-searcher world. The lessons crew encodes:

- **Allocation over locking.** The paper ranks proactive portfolio allocation (0.859) far above reactive market equilibrium (0.599). Crew's primary mechanism is disjoint decomposition at dispatch; leases are the safety net for imperfect decomposition, never the plan.
- **Pool information, never actions.** The registry centralizes evidence (who owns what, what's blocked); actions stay distributed and diverse.
- **Redundancy is the waste metric.** The paper's identity `N·Q − G = E[(K−1)⁺]` — expected redundant successes — is what allocation minimizes and the claim log measures.
- **Research fan-out is the paradox's home turf.** Agents exploring one question must carry distinct assigned angles; converging on the pooled best guess is the 0.38 protocol.

## Evidence

### Monte-Carlo (24 tasks, 12 resources, 6 workers, hidden deps p=0.10, 500 trials)

| protocol | speedup vs sequential | wasted work |
| --- | --- | --- |
| naive parallel | 0.19× | 98.6% |
| advisory leases only | 0.71× | 93.5% |
| planner DAG only | 3.71× | 40.8% |
| hybrid (DAG + advisory leases) | **4.49×** | **25.4%** |

Compliance sweep: leases-only collapses below ~95% compliance (0.73× at 85%); hybrid degrades gracefully (4.52× at 85%, 3.50× at 0%) because allocation prevents most conflicts before etiquette matters. Worker frontier saturates at 4–6 agents — matching moo's attention-span anti-pattern from the throughput side.

### Live dry-run (3 real concurrent subagents, deliberate shared-file collision)

Zero lost updates on the contested file; the one engineered conflict was caught at claim time, honored without force, resolved by reordering; a child agent decomposed its own node (recursion held); ~2× wall-clock vs summed agent time. Single run — a demonstration, not a rate (graduation criteria in HYPOTHESIS.md demand the rate).

### Landscape (July 2026 survey)

No existing tool covers the combination. Beads (`bd`): best-in-class task DAG + atomic claims, no resource leases, no liveness roster. MCP Agent Mail: best-in-class glob+TTL leases + identity, server-shaped (HTTP-only), no DAG. Agent-MCP: all three but AGPL, heavyweight, linear chains. Soloterm: leases over MCP, closed-source desktop app. Nothing addresses subagent-scoped or recursive coordination — "who am I" has no answer for an ephemeral subagent in any of them.

## Design stances

- **Fully standalone.** The tool knows nothing about any skill, plugin, or harness, and nothing else needs to know about it; it is adoptable by itself (`selftest` proves it on any machine with node). Integration into workflows is a consumer's choice, made later and elsewhere.
- **One JSON registry + zero-dep CLI** over MCP server: any runner with a shell participates; nothing to install or keep alive.
- **State in the OS temp dir, keyed by project path,** over a dotdir in the project: agents launched from the same directory share a registry, nothing pollutes the repo, no gitignore demanded of consumers, and ephemerality is physical — the OS reclaims it.
- **Hierarchical IDs as ownership** (`c1.2.1` owns under `c1.2`): recursion costs nothing; same-lineage claims never conflict — a parent delegated that territory deliberately.
- **Advisory leases with TTL + heartbeat liveness** over hard gates: conflicts inform, never block; crashed agents expire instead of wedging. Compliance is a measured rate (the claim log), fenced by a deterministic verify-net (diff vs claim log), per CLAUDE.md's model-judgment-boundary rule.
- **Glob-prefix conflict detection**, over-approximate by intent: for advisory use, cheap false conflicts beat missed ones.
- **Identity by env (`CREW_ID`)** over self-registration: whoever spawns an agent mints its node and hands it its name; "who am I" is answerable on the first tool call.

## Beads exit-ramp

If the hunch graduates beyond moo, migrate the DAG substrate to `bd` (verified in-container: atomic contested claims, depth-4 hierarchy, subtree-scoped ready-frontier, JSON everywhere) and keep only a thin lease sidecar cribbed from Agent Mail's reservation schema (`{agent, paths[], ttl, exclusive, reason}`). Not adopted now: 137 MB fast-churning binary, claims without expiry, parents claimable while children are open — wrong trade for a hunch that must stay throwaway-cheap.

## Open questions

- Naming: `crew` is the working name; settled at graduation, not before.
- Standalone repo at graduation — the runner-agnostic story eventually wants its own home.
