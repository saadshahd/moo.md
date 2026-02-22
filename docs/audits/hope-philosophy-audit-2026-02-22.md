# Hope Plugin Philosophy Audit — 2026-02-22

Systematic cross-reference of all 10 hope skills, 9 commands, 4 hooks, and 4 scripts against PHILOSOPHY.md, CLAUDE.md, and docs/statechart.md.

---

## L1: Summary

The hope plugin's *mechanics* are well-engineered — holdout separation, satisfaction gating, parallel verification, and compaction resilience work as designed. The *structural* alignment with philosophy is strong: pipeline sequencing, machine-verifiable criteria, proportional ceremony.

However, the philosophy has evolved significantly (beliefs 7–10, principles on authorship/pace/ownership) without corresponding skill updates. The skills still optimize for throughput and delegation — the newer philosophy asks when to *stop* delegating. Three hard contradictions exist with stated principles (explicit `Skill()` calls, enforcement vs. advisory gates, missing named frameworks). One stale reference source (PHILOSOPHY.md Expert System section) creates false documentation.

---

## L2: Findings by Category

### A. Hard Contradictions (philosophy says X, skills do Y)

### B. Philosophy–Skill Drift (philosophy evolved, skills didn't follow)

### C. Statechart–Skill Misalignment

### D. Documentation Staleness

### E. Missing Philosophy Coverage (principles with no skill implementation)

### F. Structural Observations (not violations, but worth noting)

---

## L3: Detailed Findings

### A. Hard Contradictions

#### A1. Explicit Skill() Calls Violate Loose Coupling

**Philosophy says:**
- CLAUDE.md: "Cross-skill invocation uses natural language triggers. No hard references, no `Skill(skill='specific:name')` calls between skills."
- PHILOSOPHY.md constraint: "Skills must use natural language triggers for cross-skill invocation"
- Hard constraint #7: "No hard dependencies on other skills — Prime and trigger naturally, never import."

**Skills do:**
- `soul/SKILL.md:145-153` — 5 explicit `Skill(skill="hope:intent")`, `hope:shape`, `hope:loop`, `hope:consult` calls
- `shape/SKILL.md:46` — `Skill(skill="hope:consult", args="panel on [goal]...")`
- `shape/SKILL.md:104` — `Skill(skill="hope:loop")`
- `intent/SKILL.md:96-98` — `Skill(skill="hope:shape")`, `hope:consult`, `hope:loop`

**Impact:** If any skill is uninstalled, the calling skill breaks. This directly contradicts "If a skill isn't installed, nothing breaks" (CLAUDE.md).

**Tension:** The pipeline architecture (intent→shape→loop) requires reliable transitions. Natural language triggers ("now clarify the intent") are less reliable than explicit invocation. This is a design-level conflict between the coupling principle and the pipeline model.

**Recommendation:** Either relax the coupling constraint to permit pipeline transitions (acknowledging the tradeoff), or rewrite handoffs as natural language directives. The first is honest; the second is fragile.

---

#### A2. Gates Enforce, Philosophy Says Advise

**Philosophy says:**
- Statechart §9: "Gates advise, never prevent — user owns their work"

**Implementation does:**
- `exit-plan-gate.sh` — hard `deny` on ExitPlanMode when OBJECTIVE, ACCEPTANCE, criteria[], or mustNot[] are missing. First 3 attempts are blocked; only the 4th passes through (max 3 denials).
- `verify/SKILL.md:23-24` — "BLOCKERs are non-negotiable — SHIP gate cannot open with active BLOCKERs."
- `deny-grep.sh` — hard deny on grep usage, no override.

**Impact:** Users cannot override gates on the first 3 attempts. This is enforcement, not advice. The verify skill explicitly says BLOCKERs cannot be skipped.

**Tension:** Advisory gates let users ship broken work. Enforcement gates frustrate experienced users who know what they're doing. The exit-plan-gate's 3-denial cap is a reasonable compromise, but the philosophy should acknowledge it.

**Recommendation:** Update statechart §9 rule to: "Gates advise by default. Enforcement is reserved for pipeline integrity (ExitPlanMode) and tool correctness (grep deny). User override exists via denial cap." Make the philosophy match the implementation.

---

#### A3. No Named Frameworks or Provenance in Skills

**Philosophy says:**
- PHILOSOPHY.md Constraints: "Every skill must have: named framework (not invented), evidence it works, clear trigger condition, provenance documented"
- Principle: "Proven over invented — Named frameworks with evidence. Novel methodology is untested."

**Skills do:**
- Zero skills cite a named framework. No skill references provenance.
- Concepts borrow from established methods (acceptance criteria → user stories, criteria/holdout → ML train/test split, wave execution → kanban, expert panels → Delphi method, pre-mortem → Klein's prospective hindsight) — but none are named or cited.

**Impact:** The skills are effectively custom methodology branded as principled. The constraint exists in the philosophy but is universally unenforced.

**Recommendation:** Either cite the frameworks that inspired each skill's process (adding a `## Provenance` section or inline citations), or soften the constraint to "Draw from established frameworks where applicable." The current state is a universal violation.

---

### B. Philosophy–Skill Drift

#### B1. Beliefs 7–10 Have No Skill-Level Implementation

The [Unreleased] changelog shows major philosophy additions that exist only in PHILOSOPHY.md and CLAUDE.md, with no corresponding skill updates:

| New Philosophy | What It Asks | Skill Gap |
|---|---|---|
| Belief 7: Understanding is the product | Slow down to build mental models | No skill checks whether the human understands what's being built. Loop spawns subagents without pause. |
| Belief 8: Every artifact is a liability | Fewer artifacts, fully owned | No skill questions whether output volume exceeds ownership capacity. Bond creates parallel streams without checking. |
| Belief 9: Agency requires authorship | Delegation requires honest verification ability | No skill checks whether the human can verify the delegated work. Bond and loop delegate freely. |
| Belief 10: Peace of mind precedes quality | Stop before calm breaks | No skill detects or responds to overwhelm, anxiety, or fragmented attention. |

**New principles with zero skill implementation:**
- "Presence over velocity" — no skill asks "should we slow down?"
- "Friction when it teaches" — no skill preserves useful friction; all optimize for speed
- "Own before producing more" — no skill pauses to check ownership before the next wave
- "Authorship over review" — no skill asks whether the human is authoring or just approving
- "Calm before more" — no skill detects attention fragmentation

**Impact:** The philosophy now has a strong stance on human agency, pace, and ownership. The skills still operate on a throughput-optimization model. The philosophy evolved past the skills.

**Recommendation:** This is the most significant gap. Options:
1. Add a soul audit check for ownership/pace signals (spec check 6: "Is the human keeping up?")
2. Add engagement-level guards in loop and bond (Guided = always pause for understanding check, Collaborative = pause at milestones, Autonomous = no pause)
3. Add a "pace check" to the wave report in loop, gated by engagement level

---

#### B2. Gumption-Aware Unstuck Strategy Not Implemented in Any Skill

PHILOSOPHY.md defines a detailed gumption-stuck taxonomy (anxiety, ego, impatience, boredom) with specific interventions. This exists only in PHILOSOPHY.md §Unstuck Strategy. No skill references it.

- Soul's audit checks 5 things: spec, fit, shape, verification, user confused. None address psychological state.
- Loop's stall detection is purely mechanical (no progress on wave).
- The "Understanding stuck" strategy (pyramid summary + probe question) is partially implemented through the `Probe before shipping` principle in loop (step 5), but the gumption variant is absent.

**Recommendation:** Soul's audit is the natural place. Add a 6th check: "User signaling overwhelm?" with detection heuristics (repeated reversals, long delays, scope thrashing, "I don't know" responses). Route to engagement-level-appropriate intervention.

---

### C. Statechart–Skill Misalignment

#### C1. Loop Claims Terminal, Statechart Shows Loop→Verify

- `loop/SKILL.md:120-122`: "Loop is a terminal phase — it produces completed, verified work. No outbound Skill() calls."
- Statechart §1 line 38: `loop --> verify : work complete, pre-PR check`

Loop explicitly says it doesn't call verify. The statechart says loop transitions to verify. The `/hope:full` command orchestrates the transition externally. But when loop runs standalone (not via `/hope:full`), verify never happens unless explicitly invoked.

**Recommendation:** Loop should mention verify as an optional next step: "After loop completion, consider running /hope:verify for pre-PR quality check" — without a `Skill()` call, consistent with natural language triggers.

---

#### C2. Satisfaction Gating: Loop vs. Statechart Disagree on <60

- `loop/SKILL.md` gating table: <60 is "advisory" for standard risk, "blocking" for critical risk.
- Statechart §4: "<60 triggers reshape consideration."

Loop says <60 is advisory (user can override). Statechart says <60 triggers reshape. These are different actions.

**Recommendation:** Align to one. The statechart's "reshape consideration" is stronger and arguably better — <60 after a full wave suggests the approach may be wrong, not just incomplete.

---

#### C3. Soul Marker Format Inconsistency

Soul SKILL.md step 3 emits: `[SESSION] Pipeline: [phases] | Engagement: [level] | Horizon: [horizon] | Feasible: [axis] ([bound])`

Statechart §7, CLAUDE.md, and `/hope:full` all describe: `[SESSION] Type: X | Engagement: Y | Horizon: Z | Feasible: W`

The `exit-plan-gate.sh` script handles both formats (checks `Pipeline:` first, falls back to `Type:` at line 64-76). But the two formats disagree on the first field — `Pipeline:` lists phases, `Type:` names the session type. They're not equivalent.

**Recommendation:** Standardize. Soul's `Pipeline:` format is richer (tells you which phases to expect). But the rest of the system uses `Type:`. Pick one, update the other.

---

#### C4. Full Command Always Runs Bond (Contradicts Scale-to-Stakes)

`/hope:full` Stage 5 unconditionally runs `Skill(skill="hope:bond")`. The statechart shows bond only triggers when "shape detects high Independence + large Scope" (§6 sources). Running bond on every full pipeline is wasteful for simple tasks.

- Soul Principle 5: "Scale ceremony to stakes — Trivial decisions need no footer."
- Bond's own Principle 3: "Not every task needs a team — Most tasks are better as solo or subagent work."

**Recommendation:** Stage 5 should be conditional: "If scope ≥ 8 story points AND multiple independent modules → run bond. Otherwise skip to Stage 6."

---

### D. Documentation Staleness

#### D1. PHILOSOPHY.md Expert System Lists 6 Skills (Actual: 10)

`PHILOSOPHY.md:242-248` lists: soul, intent, shape, bond, loop, consult. Missing: verify, observe, forge, search. This section also says "42+ profiles" — the actual count is 74.

---

#### D2. Marketplace Description Says 8 Skills (Actual: 10)

`.claude-plugin/marketplace.json` says "8 skills" in the description. Keywords list is missing "observe" and "verify".

---

#### D3. Plugin.json Description Says 10 Skills (Correct)

`hope/.claude-plugin/plugin.json` correctly says "10 skills" and lists all keywords. Only marketplace.json is stale.

---

### E. Missing Philosophy Coverage

#### E1. No Skill Implements "Retrieved Over Recalled" Check

The principle says: "Facts that can be looked up must be looked up. Questions that tools can answer must not consume human attention." Soul's audit check (step 4) includes "Facts retrieved? Key claims from memory, not source → Search/read first." This is correct in soul.

But no downstream skill enforces this. Loop subagents, bond team members, and forge all spawn subagents that rely on LLM knowledge without explicit search-first directives (only the SubagentStart hook mentions "Retrieve facts with tools before asserting from memory" — good, but it's in a compact primer, not the skill's explicit process).

**Status:** Partially covered via hook. Not a gap if the hook fires reliably (but hooks may silently discard output per issues #12151, #16538).

---

#### E2. No Skill Implements "Delete Before Add" for Memory

Principle: "Before recording new memory, check if existing entries are now wrong." Soul's Principle 8 says "Durable over recent" but doesn't mention checking for stale entries. The `core-principles` tag says "Update auto-memory when you encounter durable insights" — this is additive, not delete-first.

**Status:** Philosophy says delete-before-add. Soul says add-durable-insights. Asymmetric implementation.

---

#### E3. "Every Step Must Have a Completion Marker"

PHILOSOPHY.md Constraints: "Every step in a skill process must have a completion marker ('done when...')"

Zero skills contain explicit "done when" markers for their process steps. Process steps have implicit completion (emit brief, present output, announce card), but not the explicit format the constraint requires.

**Status:** Universal violation, though the implicit completion is usually unambiguous.

---

### F. Structural Observations

#### F1. deny-grep.sh Uses grep Internally

`deny-grep.sh:5` uses `grep -qP '(?<![a-z_-])grep(?![a-z_-])'` — the hook that denies grep uses grep itself. This works because hooks run in a separate execution context (not Claude's tool calls), but it's worth noting the irony.

---

#### F2. Bond References TeamCreate() — Claude Code Native Tool

`bond/SKILL.md:73` uses `TeamCreate(team_name=...)`. This is a Claude Code native tool, not a skill API. However, the CLAUDE.md anti-pattern says "Task management APIs in skills (TaskCreate/TaskList/TaskUpdate)." TeamCreate is a different API but in the same category. If Claude Code changes this API, bond breaks.

Also relevant: hard constraint #2 says "No Claude Code hacks — If it wouldn't survive a Claude Code update, it doesn't belong." TeamCreate is a legitimate API, but it's not yet stable.

---

#### F3. Search Skill Is Pure Reference (No Process/Boundaries)

`search/SKILL.md` is a reference card for sg and rg syntax. It has no process, principles, or boundaries sections. Unlike every other skill, it doesn't participate in the pipeline. This is acknowledged — it's a utility reference, not a pipeline skill.

---

#### F4. observe Uses [EXTRACT] Tag Not in Statechart

`observe/SKILL.md:135` emits `[EXTRACT] Key insight:...`. The [EXTRACT] pattern is defined in consult's process (step 4). Observe borrows it. The statechart doesn't mention [EXTRACT] for observe.

**Status:** Minor inconsistency. The pattern is useful and consistent in format even if not documented in the statechart.

---

#### F5. Profile Count Correct (74) But PHILOSOPHY.md Stale

74 .md files exist in `profiles/`. consult SKILL.md says "74 curated profiles" — correct. PHILOSOPHY.md says "42+" — stale (see D1).

---

## Severity Summary

| Severity | Count | IDs |
|----------|-------|-----|
| Hard contradiction | 3 | A1, A2, A3 |
| Philosophy–skill drift | 2 | B1, B2 |
| Statechart–skill misalignment | 4 | C1, C2, C3, C4 |
| Documentation staleness | 3 | D1, D2, D3 |
| Missing coverage | 3 | E1, E2, E3 |
| Structural notes | 5 | F1–F5 |
| **Total** | **20** | |

---

## Priority Recommendations

1. **Resolve the coupling contradiction (A1)** — Either update the philosophy to permit explicit Skill() calls for pipeline transitions (with rationale), or rewrite handoffs as natural language. This is the most fundamental design tension.

2. **Implement beliefs 7–10 in skills (B1)** — The philosophy's strongest new content (human agency, ownership, pace) has zero skill-level presence. Soul's audit is the primary insertion point. Consider:
   - Soul audit check 6: ownership/pace signal detection
   - Loop wave report: optional "pace check" gated by engagement level
   - Bond fitness assessment: attention-span dimension

3. **Align gate semantics (A2)** — Update statechart §9 to accurately describe the enforcement model (advisory by default, enforcement for pipeline integrity with denial cap).

4. **Fix documentation staleness (D1, D2)** — Update PHILOSOPHY.md Expert System section (10 skills, 74 profiles) and marketplace.json description (10 skills, add missing keywords).

5. **Standardize session marker format (C3)** — Pick `Pipeline:` or `Type:` and update all references.

6. **Address framework citation gap (A3)** — Either add provenance citations to skills or soften the constraint.

---

## Method

Every file in `hope/` was read: 10 skills, 9 commands, 4 scripts, `hooks.json`, `plugin.json`. Cross-referenced against `PHILOSOPHY.md` (271 lines), `docs/statechart.md` (562 lines), and `CLAUDE.md` (project instructions). Profile count verified against filesystem (74 files). Line counts verified against 200-line limit (all pass). CHANGELOG.md reviewed for unreleased changes.
