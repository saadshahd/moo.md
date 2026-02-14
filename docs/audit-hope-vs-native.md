# Audit: hope Plugin vs Claude Code Native System

**Date:** 2026-02-14
**Source:** [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts/tree/main) (ccVersion 2.1.41)
**Subject:** hope plugin (hope@3.7.11)

---

## Methodology

Compared every hope skill, hook, and command against the full set of Claude Code system prompts, agent prompts, tool descriptions, skill definitions, and system reminders extracted from the public system-prompts repo.

---

## Overlap Map

### Redundant (native already does this)

| hope feature | native equivalent | verdict |
|---|---|---|
| **deny-grep hook** (PreToolUse:Bash) | System prompt: "ALWAYS use Grep (NOT grep or rg)". Tool usage policy already instructs against bash grep. | **Remove.** Hook enforces what instructions already prohibit. |
| **soul: "read before modify"** | Doing Tasks: "NEVER propose changes to code you haven't read" | **Redundant.** Identical instruction. |
| **soul: "no time estimates"** | Tone and Style: "Never give time estimates or predictions" | **Redundant.** Identical instruction. |
| **soul: "avoid over-engineering"** | Doing Tasks: extensive anti-over-engineering instructions (don't add features, don't add error handling, don't create abstractions) | **Redundant.** Native is more detailed. |
| **soul: "security awareness"** | Doing Tasks: "Be careful not to introduce security vulnerabilities such as command injection, XSS, SQL injection" | **Redundant.** |

### Significant Overlap (native has the mechanism; hope adds a layer)

| hope feature | native equivalent | what hope adds | verdict |
|---|---|---|---|
| **bond** (team composition) | TeamCreate + TeammateTool + team-coordination reminder — full team lifecycle | Fitness scoring (independence/file ownership/coordination/scope), merge conflict prevention heuristics, coupling checks before creation | **Partial value.** The "should we even use a team?" heuristic is new. The team creation mechanism is native. |
| **forge** (agent creation) | Agent Creation Architect — translates requirements into agent JSON specs | Dynamic marketplace skill discovery, expert review via consult, interactive 2-round interview | **Partial value.** Skill discovery and expert review are new. Core agent generation is native. |
| **loop** (execution) | TodoWrite — task tracking with pending/in_progress/completed states | Wave-based execution, retry-with-context, mustNot circuit breakers, [LEARN] per wave, verification gates per item | **Partial value.** Native tracks tasks. Loop enforces execution discipline. |
| **ExitPlanMode gate** (hook) | system-reminder-verify-plan-reminder — "verify that all plan items were completed correctly" | Sequential artifact checking (OBJECTIVE, ACCEPTANCE, criteria[], mustNot[]), denies until artifacts exist, max 3 denials | **Partial value.** Native reminds; hope blocks. Enforcement mechanism is stronger. |
| **PreCompact hook** | context-compaction-summary — generic "include task overview, current state, next steps" | Extracts specific pipeline markers: [SESSION], criteria[], mustNot[], wave progress | **Partial value.** Hope preserves pipeline-specific state; native preserves generic state. |

### No Native Equivalent (unique to hope)

| hope feature | what it does | why it's unique |
|---|---|---|
| **consult** (expert simulation) | 74 curated expert profiles across 30 domains. Reason from documented positions with coverage tiers (Documented > Inferred > Extrapolated > Refuse). Panel/single/review/unblock modes. | Nothing in native Claude Code simulates domain expert perspectives. This is entirely novel. |
| **intent** (structured clarification) | Max 3 rounds of targeted questions, adversarial "what should this NOT do" question requirement, locked brief with OBJECTIVE/NON-GOALS/CONSTRAINTS/ACCEPTANCE/STOP CONDITIONS, self-audit before presenting. | Native has AskUserQuestion tool but no protocol for producing a machine-checkable spec from ambiguous input. |
| **shape** (approach selection) | Expert-informed criteria[]/mustNot[] production, collaboration mode selection (Colleague/Tool-Review/Tool), feasibility axis filtering, disposable flag for prototypes. | Native plan mode designs implementations but doesn't produce boolean pass/fail criteria or inviolable constraint sets. |
| **soul** (session orchestration) | Detect session needs, assemble pipeline from phases, set engagement level (Autonomous/Collaborative/Guided), emit [SESSION] marker, per-turn checks for spec/approach/facts. | No native session-level strategy. Native treats each turn independently. |
| **[SESSION] marker persistence** | Compact state representation surviving compaction: pipeline, engagement, horizon, feasibility, criteria, mustNot. | Native compaction produces generic summaries. Hope's marker carries specific decision criteria forward. |
| **SubagentStart context hook** | Injects soul primer + pipeline state (criteria, mustNot, ACCEPTANCE, session marker) into every spawned subagent. | Native subagents start with only the task prompt. No parent session context propagation. |
| **search** (sg/ast-grep reference) | AST-aware code search patterns for Python, TypeScript, Go, Rust. Metavariable syntax, gotchas, refactoring examples. | Native knows ripgrep via Grep tool but has zero ast-grep knowledge. |
| **loop: wave mechanics** | Execute in waves (items with no unresolved deps), carry failed items with [VERIFY] FAIL context, surface [LEARN] insight per wave, stall detection. | Native TodoWrite is a flat checklist. No wave grouping, no retry-with-context, no per-wave learning extraction. |
| **loop: mustNot circuit breakers** | Shape-defined inviolable constraints that hard-stop execution when violated. | Native "executing actions with care" is about individual action risk. Hope's mustNot is about project-specific constraint enforcement. |
| **bond: team fitness assessment** | 4-dimension scoring (independence, file ownership, coordination, scope) with override rules before team creation. | Native TeamCreate assumes you want a team. Bond asks "should this even be a team?" |

---

## Unique Value Summary

Hope's irreplaceable contributions fall into three categories:

### 1. Structured Thinking Pipeline (intent → shape → loop)

Native Claude Code has: ask questions, plan, execute.
Hope adds: a **protocol** that produces machine-checkable artifacts at each stage.

- intent produces a **locked brief** with testable ACCEPTANCE criteria
- shape produces **boolean criteria[]** and **inviolable mustNot[]**
- loop **enforces** criteria/mustNot through execution, not just tracks tasks

The pipeline's artifacts flow downstream — criteria from shape become verification targets in loop, mustNot constraints become circuit breakers. Native has no equivalent chain.

### 2. Expert Perspective Engine (consult)

74 curated profiles with documented positions, coverage tiers, and a diversity rule. Four modes (single/panel/review/unblock) each produce actionable output. Grounded in "documented work, not persona simulation."

Nothing in native Claude Code reasons from specific expert positions. This is the most differentiated feature.

### 3. Session Continuity System ([SESSION] + hooks)

The combination of:
- **SessionStart** injecting soul on every session
- **SubagentStart** propagating pipeline state to children
- **PreCompact** preserving criteria/mustNot through compaction
- **ExitPlanMode** enforcing artifact existence before plan completion

This creates a coherent session-level state that persists across compaction and propagates to subagents. Native Claude Code has no concept of session-level decision state.

---

## Recommendations

### Remove or Simplify

1. **deny-grep hook** — Native instructions already prohibit bash grep. The hook adds enforcement latency for marginal value. If kept, document it as "belt and suspenders" not unique value.

2. **soul principles that duplicate native** — "Read before modify," "no time estimates," "avoid over-engineering," "security awareness" are word-for-word in native system prompts. These waste tokens in the SessionStart injection. Strip them from soul and trust the native system.

### Evaluate for Platform Convergence

3. **bond** — Native team creation is improving. Bond's unique value is the "should this be a team?" assessment. If native adds fitness scoring, bond becomes a thin wrapper. Monitor.

4. **forge** — Native Agent Creation Architect handles the core flow. Forge's skill discovery from marketplace is unique but coupled to plugin system internals that may change. Monitor.

### Protect (Irreplaceable)

5. **consult** — No platform trajectory toward expert simulation. This is safe from convergence.

6. **intent → shape → loop pipeline** — The artifact chain (brief → criteria/mustNot → verified execution) has no native analog. Even as plan mode improves, it won't produce boolean criteria sets or inviolable constraints.

7. **Session continuity hooks** — SubagentStart context propagation and PreCompact pipeline extraction have no native equivalents and aren't on the platform roadmap based on current system prompts.

8. **search (ast-grep reference)** — Native has zero sg knowledge. This is small but entirely additive.

---

## Token Cost of Redundancy

The SessionStart hook injects the full soul SKILL.md (136 lines) into every session. Removing the 5 redundant principles (~25 lines of content after expansion) would save roughly 15-20% of the injection payload. On compaction cycles and subagent spawns, this compounds.
