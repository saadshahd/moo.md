## Context

Hope currently has 4 skills (intent, shape, consult, bond) and 0 agents. All are pre-implementation or advisory. There is no post-implementation audit capability. The official Claude Code plugin system supports agents in the `agents/` directory with persistent memory, model selection, and tool inheritance.

The `distill` agent file (`hope/agents/distill.md`) has been created and reviewed. This design documents the technical decisions behind it.

## Goals / Non-Goals

**Goals:**
- Add a post-implementation principled audit to hope's thinking discipline
- Accumulate project-specific conventions across sessions via persistent memory
- Keep the agent definition minimal — every line earns its place

**Non-Goals:**
- Style enforcement (import ordering, naming conventions, comment policy)
- Code modification — distill audits, it does not fix
- Automatic triggering — distill is deliberately invoked, not hooked to lifecycle events
- Replacing the existing `simplify` bundled skill — distill is principled audit, simplify is code cleanup

## Decisions

### Agent over Skill
**Choice:** Subagent with `memory: project`
**Why:** Persistent memory accumulates project conventions and dismissed findings across sessions. Isolated context keeps audit output clean.
**Alternative rejected:** Skill (inline) — full conversation context but no persistent memory. Audit output pollutes main context.
**Alternative rejected:** Skill (`context: fork`) — isolated but no persistent memory.

### No tool restrictions
**Choice:** Inherit all tools (no `tools` field)
**Why:** Behavioral constraint ("you do not add features or change behavior") is sufficient. Tool restrictions add complexity without clear benefit. Memory requires Write/Edit auto-enablement.
**Alternative rejected:** `tools: Read, Grep, Glob, Bash` — unnecessarily restrictive, learned from official code-simplifier agent which inherits all tools.

### Contextual input detection
**Choice:** "Recently modified work unless instructed otherwise" — agent decides mechanism.
**Why:** Learned from official code-simplifier agent. Avoids prescribing git diff commands. Agent can use git diff, file timestamps, or user-provided paths as appropriate.
**Alternative rejected:** Hardcoded `git diff HEAD` — too rigid, fails for uncommitted plans or non-git-tracked docs.

### Opus model
**Choice:** `model: opus`
**Why:** Principled audit requires deep judgment — "is this abstraction justified?" and "is this custom code doing what a library handles?" are not Haiku-grade questions.

### Per-principle output format
**Choice:** Group findings by principle, omit clean checks, "Clean." for no findings.
**Why:** Principle-first framing reinforces WHY something matters. Omitting clean checks reduces noise. "Clean." with nothing else respects the user's time.

### Project-scoped memory
**Choice:** `memory: project` — conventions accumulate per-project.
**Why:** Different codebases have different intentional patterns. A Go project's conventions differ from a TypeScript project's. User-scoped memory would mix them.

## Risks / Trade-offs

**No conversation context** → Distill can't see WHY you built something, only WHAT changed. Mitigation: the principles are context-independent (unused code is unused regardless of intent).

**Opus cost** → Each invocation uses the most expensive model. Mitigation: distill is deliberately invoked (not automatic), so cost is user-controlled.

**First agent in hope** → No existing pattern to follow. Mitigation: followed official code-simplifier agent as reference. Plugin agent discovery is well-documented.

**Memory staleness** → Saved conventions may become outdated as project evolves. Mitigation: memory guidance says "do not save specific findings or file paths" — only structural patterns which change slowly.
