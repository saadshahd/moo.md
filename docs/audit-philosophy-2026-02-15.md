# Philosophy Audit — 2026-02-15

Systematic audit of the moo.md repository against PHILOSOPHY.md, CLAUDE.md conventions, and the canonical statechart.

---

## Methodology

Every file in the repo was checked against:
- 7 core beliefs (CLAUDE.md §Philosophy)
- 10 hard constraints (PHILOSOPHY.md §Hard Constraints)
- Anti-pattern list (CLAUDE.md §Anti-Patterns)
- Convention rules (frontmatter, line limits, file structure, naming)
- Statechart alignment (docs/statechart.md as canonical)

---

## Findings — Issues

### 1. `deny-grep.sh` broken: nested quotes produce invalid JSON

**File:** `hope/scripts/deny-grep.sh:6-12`

The jq expression contains unescaped double quotes inside a string value:
```
permissionDecisionReason: "...Run Skill(skill="hope:search") to know more"
```

The `"` before `hope:search` terminates the jq string, producing a parse error. Verified by running the script — jq emits a compile error and the hook produces no output. The grep-deny hook is **functionally broken**.

**Violates:** Encode what humans forget (belief 2) — the constraint exists but doesn't fire. Also: machine-verifiable (the hook silently fails).

**Fix:** Escape the inner quotes: `Skill(skill=\\\"hope:search\\\")` or restructure with a variable.

---

### 2. `[SESSION]` marker format: soul diverges from statechart

**Soul SKILL.md:67:**
```
[SESSION] Pipeline: [phases] | Engagement: [level] | Horizon: [horizon] | Feasible: [axis] ([bound])
```

**Statechart (docs/statechart.md:353), CLAUDE.md:205, full.md:20:**
```
[SESSION] Type: Build | Engagement: Collaborative | Horizon: Strategic | Feasible: time (2h)
```

Soul uses `Pipeline:` with a phase list. Everything else uses `Type:` with a session type name. The `exit-plan-gate.sh` works around this by checking both formats (lines 64-76), but the inconsistency means:
- Downstream consumers must handle two formats
- The workaround in exit-plan-gate.sh is a code smell — it compensates for a source disagreement

**Violates:** Statechart is canonical (CLAUDE.md §Statechart). Co-located constraints — the marker format should be defined once.

**Note:** Soul's `Pipeline:` format represents a real evolution — signal-based routing ("clarify → shape → execute") vs. rigid type routing (Build/Debug/Plan/Reflect). Soul's "Read the room" table (lines 44-56) routes by signals, not types. This is arguably better design, but it contradicts the canonical reference. Either the statechart should be updated to match soul, or soul should emit the `Type:` format.

---

### 3. PHILOSOPHY.md hard constraint numbering: #8 is missing

**File:** `PHILOSOPHY.md:164-165`

Numbering goes 1, 2, 3, 4, 5, 6, 7, 9, 10. Constraint #8 is skipped.

**Violates:** Machine-verifiable (principle) — a numbered list with gaps suggests a deletion that wasn't cleaned up, or an insertion error.

**Fix:** Renumber 9 → 8 and 10 → 9.

---

### 4. No skill has per-step completion markers

**PHILOSOPHY.md:207:** "Every step in a skill process must have a completion marker ('done when...')"

Zero skills contain "done when" annotations on individual process steps. Grep across all SKILL.md files returns no matches. Process flows are clear from structure, but the explicit constraint from PHILOSOPHY.md is universally unmet.

**Violates:** The constraint itself. Also: machine-verifiable — without explicit markers, step completion is judgment-based.

**Scope:** All 7 skills. Most impactful in loop (wave completion is well-marked, but decompose/accept-brief steps are not) and soul (session setup steps lack markers).

---

### 5. `full.md` routes Reflect through bond unnecessarily

**File:** `hope/commands/full.md:40-45`

Reflect skips Stage 4 (shape) correctly, but proceeds to Stage 5 (bond) before Stage 6 (consult). The statechart defines Reflect's pipeline as `intent → consult → output` with no bond step.

Bond would assess fitness and return "Solo" for a retrospective session. The step isn't harmful, but it's unnecessary ceremony.

**Violates:** No cargo cult process (hard constraint 7) — bond adds a step without reason for Reflect sessions. Statechart alignment — the canonical reference doesn't include bond for Reflect.

**Fix:** Add "Reflect: skip to Stage 6" in Stage 5.

---

### 6. `deny-grep.sh` inconsistent script conventions

**File:** `hope/scripts/deny-grep.sh`

| Convention | Other scripts | deny-grep.sh |
|---|---|---|
| Shebang | `#!/usr/bin/env bash` | `#!/bin/bash` |
| Safety flags | `set -euo pipefail` | absent |
| JSON output | heredoc with escape function | inline jq |

This script was likely written separately and never harmonized.

**Violates:** Co-located constraints — conventions should be consistent across all scripts in the same directory.

---

## Findings — Ambiguities

### A. "Max 3 supporting files per skill" vs. 74 profiles

**CLAUDE.md:** "Supporting files: max 3 per skill (data files like profiles, templates)"

Consult has 74 profile files in `profiles/`. The CLAUDE.md structure tree explicitly documents `profiles/` as valid. The rule likely means "max 3 types of supporting resources" (profiles = 1 type), not "max 3 individual files." But the wording is ambiguous.

**Recommendation:** Clarify in CLAUDE.md: "max 3 supporting file groups" or "max 3 supporting files (profile directories count as 1)."

### B. Self-contained vs. profile dependency

**CLAUDE.md:** "Self-contained: SKILL.md works without loading external files"

Consult SKILL.md references `profiles/` (line 43) and the domain map table (lines 117-148) enables expert routing. The skill would function at reduced quality without profiles (using the domain map + LLM knowledge), but profiles are the documented data source for expert simulation.

This is a reasonable design choice — the SKILL.md contains routing logic, profiles contain data. Not a violation, but the "self-contained" principle deserves a data-file exception note.

---

## Findings — Compliant

All of the following passed audit:

| Check | Status |
|---|---|
| SKILL.md line counts (all ≤ 200) | Pass |
| No `references/` directories | Pass |
| No persistent state files | Pass |
| No `version` in SKILL.md frontmatter | Pass |
| No multi-line YAML blocks in frontmatter | Pass |
| No generic names (*Manager, *Helper, *Utils) | Pass |
| No DOT visual attributes (fillcolor, style, shape) | Pass |
| No backslash paths | Pass |
| All descriptions follow WHAT + WHEN pattern | Pass |
| All commands have proper frontmatter | Pass |
| Hooks sync/async matches documented architecture | Pass |
| No navigation/catalog sections in skills | Pass |
| Pipeline handoffs match between skills | Pass |
| Profile count (74) matches domain map | Pass |
| Skill count (7), command count (8) match CLAUDE.md | Pass |
| All referenced files exist (docs, statechart, plugin.json, marketplace.json) | Pass |
| Pre-push git hook enforces conventions | Pass |
| No persistent state in scripts (output only) | Pass |
| plugin.json version is single source of truth | Pass |
| Skills respect state machine mapping | Pass (except finding 2) |

---

## Priority

| # | Finding | Severity | Philosophy principle violated |
|---|---|---|---|
| 1 | deny-grep.sh broken JSON | **High** | Encode what humans forget — hook exists but doesn't work |
| 2 | [SESSION] marker format split | **Medium** | Statechart is canonical — two formats, one workaround |
| 5 | full.md Reflect → bond | **Low** | No cargo cult — harmless but unnecessary step |
| 4 | Missing completion markers | **Low** | Machine-verifiable — process flows are clear despite missing markers |
| 3 | PHILOSOPHY.md numbering gap | **Trivial** | Cosmetic |
| 6 | deny-grep.sh conventions | **Trivial** | Consistency |
