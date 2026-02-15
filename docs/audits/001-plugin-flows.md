# Audit 001 — Plugin Flows, Philosophy Alignment, Feasibility

**Date:** 2026-02-15
**Scope:** All 8 skills, 9 commands, 4 hooks, 4 scripts, statechart, philosophy
**Method:** Full file read + Claude Code docs + GitHub issue verification

---

## Executive Summary

Five systemic issues, ordered by user impact:

1. **Missing generative flow** — Soul promises "consult (generative mode)" for brainstorming. Consult has no generative mode. Users with intent but not know-how fall through to shape, which assumes an approach exists to evaluate.
2. **Loose coupling violated in 4/8 skills** — Soul, intent, shape, and the full command use hard `Skill(skill="hope:...")` calls. Only forge correctly uses natural language triggers.
3. **Output volume contradicts philosophy** — Hard constraint #10 says "default to less." Skills mandate comprehensive structured output (intent: 6 sections, shape: 8 fields, loop: 4-section report) regardless of task complexity.
4. **Bond teams are ephemeral — no memory** — Bond creates ad-hoc `Task()` agents. These don't use `.claude/agents/` memory scopes. Teams can't learn across sessions.
5. **Stale references across docs** — PHILOSOPHY.md says 6 skills/42 profiles (actual: 8/74). docs/plugins/hope.md lists 6 skills, missing forge and search. Statechart §8 omits 2 of 4 hooks.

---

## Critical Findings

### C1. No Generative/Enrichment Mode in Consult

**What:** Soul's "read the room" table (soul:44-56) routes `"brainstorm", "what if"` to `consult (generative mode)`. But consult only has 4 modes: Single, Panel, Review, Unblock. No generative mode exists.

**Impact:** When a user has intent but not know-how (e.g., "I want to improve performance but I don't know where to start"), they get routed to shape, which calls a panel to "assess risks, patterns, coupling, ambiguity, approach tradeoffs" — all evaluative, not generative. The user needs experts brainstorming *possibilities*, not evaluating a non-existent approach.

**Gap in statechart:** No state between intent and shape for discovery. The pipeline assumes linear progression: clarify WHAT → decide HOW → execute. But sometimes after clarifying WHAT, you need to *explore* HOW before committing to shape it.

**Recommendation:** Add a 5th consult mode: **Explore**. Purpose: given a clear intent, brainstorm approaches, surface what the user doesn't know they don't know, and produce a shortlist of viable paths before shape evaluates one. This fills the gap between "I know what I want" (intent done) and "I know how to do it" (shape ready).

**Feasibility:** Pure skill content change. No platform dependency. Consult already has the expert selection and panel mechanics — this adds a generative framing rather than evaluative.

---

### C2. Loose Coupling Violations

**Philosophy:** "Cross-skill invocation uses natural language triggers. No hard references, no `Skill(skill="specific:name")` calls between skills." (PHILOSOPHY.md:178)

**Violations found:**

| File | Line | Hard Reference |
|------|------|----------------|
| soul/SKILL.md | 139-148 | `Skill(skill="hope:intent")`, `Skill(skill="hope:shape")`, `Skill(skill="hope:loop")`, `Skill(skill="hope:consult")` |
| intent/SKILL.md | 96-98 | `Skill(skill="hope:shape")`, `Skill(skill="hope:consult")`, `Skill(skill="hope:loop")` |
| shape/SKILL.md | 43-48 | `Skill(skill="hope:consult", args="panel on [goal]...")` |
| commands/full.md | 23-54 | All 5 skills via explicit `Skill()` calls |

**Only forge does it correctly** (forge/SKILL.md:74-79): uses natural language `"Panel review of this agent design..."` to trigger consult.

**Why it matters:**
- Hard references break if the target skill isn't installed or changes name
- They bypass the description-matching system that Claude uses for skill selection
- They create invisible coupling — removing consult would break soul, intent, and shape

**Recommendation:** Replace hard `Skill()` calls in skills with natural language action directives. Example: soul's `Skill(skill="hope:intent")` → `"Clarify intent: turn this rough idea into a testable work order."` Commands (user-facing entry points) may keep explicit `Skill()` calls since they serve as orchestrators.

**Feasibility:** Pure content change. Natural language triggers work through Claude's description matching (~50-80% reliability). But this is the designed mechanism — hard Skill() calls from skills aren't architecturally better since they still go through Claude's tool selection, and they create the coupling the philosophy explicitly forbids.

---

### C3. Output Volume vs. Philosophy

**Hard constraint #10:** "Default to less. Expand on request. Every response starts at minimum disclosure."

**Reality in skills:**

| Skill | Mandated Output | Min Sections |
|-------|----------------|--------------|
| intent | OBJECTIVE + NON-GOALS (3-5) + CONSTRAINTS + ACCEPTANCE (7-12 bullets) + STOP CONDITIONS (3-5) + BLAST RADIUS | 6 sections, 16-27 bullets |
| shape | Key findings + tensions + mode + criteria[] + mustNot[] + disposable + start action + pre-mortem | 8 fields |
| loop | OUTCOME + DECISIONS (2-4) + EVIDENCE (per criterion) + DETAILS | 4 sections |
| consult panel | Per concern (2-4) + tension + test | 4-6 items |

**Contradiction:** Intent always produces the full brief regardless of task complexity. A 1-point "rename this variable" task gets the same 6-section brief as a 13-point architecture change. Soul's sizing table (soul:104-111) scales from 1 to 13+ points, and Communication Depth (soul:116-124) scales from "outcome sentence only" to "full pyramid + pre-mortem." But intent and shape don't scale.

**Recommendation:** Add sizing-aware scaling to intent and shape:
- **Trivial (1-3 points):** OBJECTIVE + 3 ACCEPTANCE bullets + 1 mustNot. No NON-GOALS, no BLAST RADIUS.
- **Standard (5-8):** Full brief as-is.
- **Critical (13+):** Full brief + pre-mortem.

**Feasibility:** Skill content change. Soul already classifies sizing — this just propagates the classification into intent and shape output formats.

---

### C4. Bond Creates Ephemeral Teams Without Memory

**Current behavior:** Bond designs teams and spawns via `Task()` with `subagent_type` from the design table. These are ephemeral subagents with no memory persistence.

**What forge does:** Creates `.claude/agents/<name>.md` files with `memory: user|project|local` scopes. Agents consult `MEMORY.md` before starting and update after completing work. This is the persistent agent path.

**Gap:** Bond and forge don't connect. Bond creates throwaway teams. Forge creates persistent individuals. Neither creates persistent teams.

**Platform reality:**
- `.claude/agents/` memory scopes work (documented, functional)
- **But:** Issue [#24316](https://github.com/anthropics/claude-code/issues/24316) — "Allow custom .claude/agents/ definitions as agent team teammates" is an open feature request. Custom agents can't be used as team members yet.
- Agent Teams (`TeamCreate`) is experimental and has significant bugs: [#23983](https://github.com/anthropics/claude-code/issues/23983) (permission hooks not firing), [#24073](https://github.com/anthropics/claude-code/issues/24073) (tool access lost in delegate mode), [#25254](https://github.com/anthropics/claude-code/issues/25254) (VS Code deadlocks)

**Recommendation (feasible now):** When bond designs a team, it should offer to forge persistent agents for roles that will recur. "This team has 3 roles. Role X is a recurring need — want to forge it as a persistent agent with memory?" This connects bond → forge naturally without requiring platform changes.

**Recommendation (blocked by platform):** Wait for [#24316](https://github.com/anthropics/claude-code/issues/24316) to land, then update bond to use forge-created agents as team members directly.

---

## High-Priority Findings

### H1. Statechart Has Double Consultation

**Statechart §1:** `shape --> consult --> loop` for Build/Debug/Plan.

**But:** Shape step 2 already invokes consult internally (panel on intent brief). So the full pipeline runs:

```
intent → shape (calls consult panel internally) → consult (second pass) → loop
```

The full command acknowledges this: "Shape already includes domain-expert consultation. This stage is an optional second-opinion review pass." But the statechart doesn't reflect the internal consultation — it shows consult as a separate mandatory step.

**Recommendation:** Update statechart to show consultation as internal to shape, with an optional review pass between shape and loop. This matches actual behavior and reduces mandatory ceremony.

---

### H2. Subagents Don't Inherit Skills

**Platform fact:** Subagents spawned via `Task()` do NOT inherit skills from the parent session. Skills must be explicitly preloaded via the `skills` frontmatter field on `.claude/agents/` files. (Confirmed via Claude Code docs.)

**Impact on loop:** Loop step 3 spawns `Task(..., subagent_type="general-purpose")`. These subagents:
- Can't use the search skill (no sg/rg reference)
- Can't invoke consult when stuck
- Can't benefit from forge-created agents

The SubagentStart hook injects session context (primer + pipeline state) but not skill access.

**Impact on bond:** Bond team members are Task-spawned agents. Same limitations.

**Recommendation:** For loop subagents, embed key reference material directly in the Task prompt (co-located constraints — PHILOSOPHY principle). For bond team members, include skill-relevant guidance in the team member prompt. This follows the co-location principle rather than depending on skill inheritance.

---

### H3. Skill Auto-Triggering Is Unreliable (~50% Without Optimization)

**Research findings:**
- [scottspence.com evaluation](https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably): ~50% activation rate for keyword matches without forced-eval hooks, ~80-84% with UserPromptSubmit hook forcing evaluation
- [Issue #21947](https://github.com/anthropics/claude-code/issues/21947): Skills not auto-triggering despite matching descriptions

**Impact on hope:** If soul auto-triggers on ~50% of sessions (without /hope:full), the entire pipeline is unreliable for organic use. Users who don't explicitly invoke /hope:full may never see the thinking infrastructure.

**Mitigating factor:** SessionStart hook injects soul content directly. So even without skill auto-triggering, soul's principles and tables are in context. But the auto-handoff (soul detecting session type and routing to intent/shape/loop) depends on Claude interpreting the injected content as an action directive.

**Recommendation:** The SessionStart hook injection is the reliable path. Strengthen it. Currently it says "Apply hope:soul." — consider making the action directive more explicit: "On this first turn, detect session type from the user's message, set engagement level, and emit the [SESSION] marker. If the request is vague, clarify intent before proceeding."

**Platform limitation:** A UserPromptSubmit hook that forces skill evaluation would help reliability, but [Issue #10225](https://github.com/anthropics/claude-code/issues/10225) confirms UserPromptSubmit hooks from plugins don't execute. Only `--plugin-dir` or user-level config works.

---

### H4. Plugin Hooks Broken for Marketplace Installs

**Status:** Still broken as of 2026-02-15.

**Issues:**
- [#12151](https://github.com/anthropics/claude-code/issues/12151) (open, stale label): Plugin hook output silently discarded
- [#16538](https://github.com/anthropics/claude-code/issues/16538) (open): Plugin SessionStart hooks don't surface additionalContext

**Impact:** The most critical hook (SessionStart injecting soul) doesn't work for marketplace installs. Users who install hope via `/plugin install hope@moo.md` get a broken experience — soul never loads, pipeline never starts.

**Current workaround:** `claude --plugin-dir ./moo.md` (documented in CLAUDE.md). Works but requires manual invocation.

**Additional hook bugs affecting hope:**
- [#24794](https://github.com/anthropics/claude-code/issues/24794): Async hook parser silently drops multi-line JSON
- [#24115](https://github.com/anthropics/claude-code/issues/24115): Plugin hooks fire twice from marketplace source + cache
- [#20432](https://github.com/anthropics/claude-code/issues/20432): Plugin install doesn't preserve executable permissions on shell scripts

**Recommendation:** No action possible within the plugin. Document the limitation prominently in getting-started.md and suggest `--plugin-dir` as the primary usage path until Anthropic fixes the plugin hook pipeline.

---

## Medium-Priority Findings

### M1. PHILOSOPHY.md Stale Data

| Item | PHILOSOPHY.md says | Actual |
|------|-------------------|--------|
| Skill count | "6 skills" (line 186) | 8 skills (add forge, search) |
| Profile count | "42+ profiles" (line 192) | 74 profiles |
| Skill list | soul, intent, shape, bond, loop, consult | Missing forge, search |

---

### M2. docs/plugins/hope.md Stale Data

| Item | hope.md says | Actual |
|------|-------------|--------|
| Skills table | 6 skills | Missing forge, search |
| Profile count | "42 curated profiles" | 74 profiles |
| Consult description | "42 curated profiles" | 74 curated profiles |

---

### M3. Statechart §8 Missing Hooks

Statechart §8 lists 3 hooks: SessionStart, SubagentStart, PreToolUse:ExitPlanMode.

Missing from statechart:
- **PreToolUse:Bash** — deny-grep.sh (enforces rg/sg over grep)
- **PreCompact** — prompt-based extraction of pipeline state

---

### M4. deny-grep.sh Uses grep Itself

`deny-grep.sh` line 5: `echo "$COMMAND" | grep -qP '(?<![a-z_-])grep(?![a-z_-])'`

The hook that denies grep usage itself uses grep. Should use rg or bash built-in pattern matching for consistency.

---

### M5. Bond Depends on Experimental TeamCreate API

Bond step 3 uses `TeamCreate(team_name=...)` and `Task(team_name=...)`. Agent Teams requires opt-in via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

Active bugs:
- [#23983](https://github.com/anthropics/claude-code/issues/23983): Permission hooks not firing for subagent requests
- [#24073](https://github.com/anthropics/claude-code/issues/24073): Teammates lose tool access in delegate mode
- [#25254](https://github.com/anthropics/claude-code/issues/25254): Messages not delivered in VS Code
- [#23629](https://github.com/anthropics/claude-code/issues/23629): TaskUpdate status not synced

Bond should note the experimental status and degrade gracefully when teams aren't available (suggest subagent or solo approach).

---

### M6. Memory Leak Risk When Subagents Invoke Skills

[Issue #21965](https://github.com/anthropics/claude-code/issues/21965): 400MB → 14GB memory explosion when subagents invoke the Skill tool.

**Impact:** If loop subagents or bond team members attempt to invoke skills (e.g., consult for unblocking), this could cause session crashes. The SubagentStart hook doesn't inject skill access, which may inadvertently protect against this — but it also means subagents can't consult.

---

## User Pain Points — Root Cause Analysis

### "Consultation doesn't happen automatically when it matters"

**Root causes:**
1. Soul routes "brainstorm/what if" to non-existent "generative mode" (C1)
2. Skill auto-triggering ~50% reliable (H3)
3. Shape's consultation is evaluative, not generative — asks "is this approach good?" not "what approaches exist?" (C1)
4. Engagement level matrix (statechart §1) says `consult: Auto-invoked on stalls` for Autonomous — but consult's Unblock mode requires a parsed blocker (task + error + failed approach). If the user isn't stuck but just doesn't know the domain, Unblock doesn't apply.

### "I still have to remind it about simple things — it doesn't use memory"

**Root causes:**
1. Skills are stateless by design — no persistent memory across sessions (PHILOSOPHY hard constraint #1)
2. SessionStart hook re-injects soul every session but carries no session-to-session learnings
3. Agent memory (user/project/local scopes) exists in Claude Code but is only available to `.claude/agents/` subagents, not to the main conversation or skills
4. The "Retrieved over recalled" principle (PHILOSOPHY) is about using tools to check facts, not about remembering preferences or patterns across sessions

**Platform reality:** There is no mechanism for skills or the main conversation to have persistent memory. CLAUDE.md is the closest thing — it's read every session. User preferences would need to go there or in a separate `.claude/` file that a SessionStart hook reads.

### "Forge doesn't create agents with memories as teams"

**Root causes:**
1. Forge DOES support memory — it asks about memory scope and generates the `memory:` field (forge/SKILL.md:37, 71)
2. But forge creates individual agents, not teams
3. Bond creates teams but as ephemeral Task() agents without memory
4. No bridge between forge (persistent, individual) and bond (ephemeral, team)
5. Platform doesn't yet support custom agents as team members ([#24316](https://github.com/anthropics/claude-code/issues/24316))

### "Output is too verbose and overwhelming"

**Root causes:**
1. Intent always produces full 6-section brief regardless of task sizing (C3)
2. Shape always produces 8-field output regardless of complexity (C3)
3. Soul says "default to less" but doesn't enforce it on other skills
4. Consult panel output, while recently refactored to concern-oriented format (3.8.1), still produces structured multi-section output
5. The philosophy adds "Hypothesis before artifact" (present intent before implementation) — good principle, but combined with mandatory structured output, it means the user sees 2+ structured artifacts before any code

---

## Ideal Usage Flows (Current vs. Proposed)

### Current: /hope:full for "build a REST API"

```
Session (ask engagement) → Intent (3 rounds, 6-section brief) → Shape (panel, 8-field output) → Consult (optional second review) → Bond (assess, often Solo) → Loop (waves)
```

**Minimum turns before code:** 4-6 (session setup, 1-3 intent rounds, shape presentation, bond assessment)

### Proposed: Sizing-Aware Pipeline

```
Soul detects: Build, Standard (5 points)
→ Intent: OBJECTIVE + 5 ACCEPTANCE bullets + 1 mustNot (scaled to sizing)
→ Shape: criteria[] + mustNot[] + start action (skip pre-mortem for standard)
→ Loop: execute
```

```
Soul detects: Build, Trivial (1 point)
→ Skip intent (spec clear from message)
→ Skip shape (approach obvious)
→ Execute directly with verification
```

```
Soul detects: Build, user lacks domain knowledge
→ Intent (clarify WHAT)
→ Consult Explore mode (brainstorm HOW options)
→ User selects path
→ Shape (evaluate selected path)
→ Loop
```

---

## Action Items

| # | Finding | Action | Scope | Blocked? |
|---|---------|--------|-------|----------|
| C1 | Missing generative consult mode | Add Explore mode to consult | consult/SKILL.md, statechart | No |
| C2 | Loose coupling violations | Replace Skill() with natural language in skills | soul, intent, shape SKILL.md | No |
| C3 | Output not scaled to sizing | Add sizing-aware output templates | intent, shape SKILL.md | No |
| C4 | Bond teams have no memory | Connect bond → forge for recurring roles | bond/SKILL.md | No |
| H1 | Double consultation | Update statechart, make post-shape consult optional | statechart, full.md | No |
| H2 | Subagents don't inherit skills | Co-locate key guidance in Task prompts | loop, bond SKILL.md | No |
| H3 | Auto-trigger unreliable | Strengthen SessionStart action directive | session-start.sh | No |
| H4 | Plugin hooks broken | Document limitation in getting-started.md | docs | Blocked by Anthropic |
| M1 | PHILOSOPHY.md stale | Update counts and skill list | PHILOSOPHY.md | No |
| M2 | hope.md stale | Update skill table and profile count | docs/plugins/hope.md | No |
| M3 | Statechart missing hooks | Add PreToolUse:Bash and PreCompact | statechart.md | No |
| M4 | deny-grep uses grep | Replace with rg or bash pattern | deny-grep.sh | No |
| M5 | Bond on experimental API | Add graceful degradation | bond/SKILL.md | No |
