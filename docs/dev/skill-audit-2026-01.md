# Skill Audit Report - January 2026

## Summary

| Skill | Score | Delta | Description | Top Issue | Verdict |
|-------|-------|-------|-------------|-----------|---------|
| hope:soul | 98/120 | [A] | ✓ | SKILL.md at 492 lines (borderline Dump) | SHIP |
| hope:trace | 102/120 | [A] | ✓ | Minor: no explicit examples | SHIP |
| hope:gate | 100/120 | [A] | ✓ | Could use example verification output | SHIP |
| hope:recall | 78/120 | [A] | ✗ | Missing KEYWORDS in description | REVISE |
| hope:intent | 95/120 | [A] | ✓ | Missing eval examples | SHIP |
| hope:breakthrough | 96/120 | [A] | ✓ | Strong, minor: reference-heavy | SHIP |
| hope:skill-judge | 105/120 | [A] | ✓ | Excellent meta-skill | SHIP |
| counsel:counsel | 94/120 | [A] | ✓ | Good, relies heavily on references | SHIP |
| founder:founder | 88/120 | [A] | ✓ | Router pattern; thin on its own | SHIP |
| career:career | 86/120 | [A] | ✓ | Router pattern; thin on its own | SHIP |
| product:product | 82/120 | [A] | ✗ | Description missing WHEN, sparse guidance | REVISE |
| wordsmith:writing | 84/120 | [A] | ✓ | Router pattern; thin rules section | SHIP |
| wordsmith:template | 90/120 | [A] | ✗ | Description missing WHEN/KEYWORDS | REVISE |
| design:design | 92/120 | [A] | ✓ | Good exploration focus | SHIP |
| loop:start | 94/120 | [A] | ✓ | Well-structured autonomous loop | SHIP |
| loop:cancel | 58/120 | [A] | ✗ | Too thin, missing WHEN/KEYWORDS | REVISE |
| loop:help | 62/120 | [R] | ✗ | Near-redundant, basic documentation | REVISE |

**Overall:** 12 SHIP, 5 REVISE, 0 REJECT

---

## Priority Fixes

1. **loop:cancel**: Needs WHEN/KEYWORDS in description; too sparse for standalone skill
2. **loop:help**: Borderline redundant - consider merging into loop:start or README
3. **hope:recall**: Add KEYWORDS to description ("recall learnings", "past failures", "surface insights")
4. **product:product**: Add explicit WHEN triggers and KEYWORDS to description
5. **wordsmith:template**: Add WHEN triggers ("write RFC", "create ADR", "blog post template")
6. **hope:soul**: Consider splitting to references to get under 300 lines

---

## Detailed Evaluations

### hope:soul

**Summary**
- Score: 98/120 (Good)
- Knowledge Delta: [A]ctivation - Claude knows these frameworks but needs structured prompting
- Pattern Match: Philosophy → Philosophy (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 14/15 | Clear: "cognitive operating system for structured thinking" |
| Knowledge Delta | 17/20 | Strong [A]: Silent Audit, confidence gates, workflows are high-value prompting |
| Description Quality | 13/15 | WHAT ✓, WHEN ✓, KEYWORDS partial (triggers on "any request") |
| Progressive Disclosure | 10/15 | 492 lines is borderline; good reference linking but dense |
| Freedom Calibration | 13/15 | Appropriate medium freedom for judgment tasks |
| Output Format | 9/10 | Quality Footer template clear; workflow outputs defined |
| Anti-Pattern Coverage | 13/15 | "Common Rationalizations" table excellent |
| Testability | 9/15 | Hard to test "thinking framework" - success is judgment-based |

**Description Analysis**
- [x] WHAT present: "moo hope - cognitive operating system"
- [x] WHEN present: "MANDATORY for ALL tasks"
- [~] KEYWORDS present: implicit ("any request") rather than explicit phrases
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
- #2 The Dump (LOW): 492 lines is near threshold; mitigated by heavy reference use
- #8 The Monologue (NONE): Well-structured with tables throughout

**Recommendations**
1. Move "All Tools" table and "Tool Pairings" to a reference file (-100 lines)
2. Consider splitting Workflows A/B/C to references (keep summaries)
3. Add explicit trigger keywords like "confidence", "inversion", "library search"

**Verdict**
SHIP - Core skill, well-structured, high activation value. Minor optimizations possible.

---

### hope:trace

**Summary**
- Score: 102/120 (Excellent)
- Knowledge Delta: [A]ctivation - Five Whys + prevention hierarchy is structured framework
- Pattern Match: Process → Process (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 15/15 | Perfect: "Root cause analysis when surface fixes fail" |
| Knowledge Delta | 16/20 | Strong [A]: Five Whys with confidence gates + prevention hierarchy |
| Description Quality | 14/15 | WHAT ✓, WHEN ✓, KEYWORDS implicit but strong |
| Progressive Disclosure | 14/15 | 130 lines, excellent density |
| Freedom Calibration | 14/15 | Appropriately constrained for incident response |
| Output Format | 10/10 | Complete template with all fields |
| Anti-Pattern Coverage | 12/15 | Good anti-patterns table; could add more |
| Testability | 7/15 | Incidents are hard to simulate for evals |

**Description Analysis**
- [x] WHAT present: "Root cause analysis for complex bugs"
- [x] WHEN present: "when initial fix fails or incident is severe"
- [~] KEYWORDS: implicit ("Effect → Cause → Root") - could be more explicit
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add explicit keywords: "postmortem", "five whys", "incident analysis"
2. Consider adding example input/output for testability
3. Link to blameless.md is good intra-plugin sharing

**Verdict**
SHIP - Clean, focused, high-value activation skill.

---

### hope:gate

**Summary**
- Score: 100/120 (Excellent)
- Knowledge Delta: [A]ctivation - Verification checklist Claude needs prompting for
- Pattern Match: Process → Process (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 15/15 | Perfect: "Verify before claiming completion" |
| Knowledge Delta | 15/20 | Solid [A]: Verification types table is key contribution |
| Description Quality | 14/15 | WHAT ✓, WHEN ✓, KEYWORDS implicit |
| Progressive Disclosure | 14/15 | 112 lines, excellent |
| Freedom Calibration | 14/15 | Appropriately strict for verification |
| Output Format | 8/10 | Checklists clear; could show example verification output |
| Anti-Pattern Coverage | 13/15 | "Common Rationalizations" table excellent |
| Testability | 7/15 | Testing "verification happened" is meta-difficult |

**Description Analysis**
- [x] WHAT present: "Verification before completion claims"
- [x] WHEN present: 'when about to say "done", "fixed", or "complete"'
- [~] KEYWORDS: the completion words are keywords, could add more
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add example of good vs bad verification output
2. Keywords could include "ready to ship", "all done", "finished"

**Verdict**
SHIP - Critical skill for quality control.

---

### hope:recall

**Summary**
- Score: 78/120 (Needs Work)
- Knowledge Delta: [A]ctivation - Surfacing learnings is valuable
- Pattern Match: Tool → Tool (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 12/15 | Clear purpose, but activation conditions could be sharper |
| Knowledge Delta | 12/20 | Moderate [A]: learnings system is valuable but simple |
| Description Quality | 8/15 | Missing KEYWORDS entirely |
| Progressive Disclosure | 13/15 | 53 lines, concise |
| Freedom Calibration | 12/15 | Appropriate for retrieval task |
| Output Format | 9/10 | Clear output sections defined |
| Anti-Pattern Coverage | 4/15 | No anti-patterns section |
| Testability | 8/15 | Testable but requires learnings files to exist |

**Description Analysis**
- [x] WHAT present: "Surface relevant learnings from past sessions"
- [~] WHEN present: partial ("session start", "before work")
- [ ] KEYWORDS missing: no trigger phrases
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
- #3 The Invisible Skill (MEDIUM): Missing keywords reduces discoverability

**Recommendations**
1. **CRITICAL**: Add keywords: "recall learnings", "past failures", "what did I learn", "surface insights"
2. Add anti-patterns: "recalling during incident" (wrong time), "broad context" (too vague)
3. Add example with sample JSONL content

**Verdict**
REVISE - Functional but invisible. Fix description.

---

### hope:intent

**Summary**
- Score: 95/120 (Good)
- Knowledge Delta: [A]ctivation - Clarification protocol is high-value
- Pattern Match: Process → Process (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 14/15 | Clear: "Turn rough ideas into iron-clad work orders" |
| Knowledge Delta | 16/20 | Strong [A]: Spec scoring, Loop 1/2 concepts, protocol |
| Description Quality | 14/15 | WHAT ✓, WHEN ✓, KEYWORDS ✓ |
| Progressive Disclosure | 12/15 | 183 lines, well-structured |
| Freedom Calibration | 13/15 | Appropriately structured for clarification |
| Output Format | 10/10 | High-Grade Intent template excellent |
| Anti-Pattern Coverage | 8/15 | Loop 2 warnings good; could add more |
| Testability | 8/15 | Testable with vague input scenarios |

**Description Analysis**
- [x] WHAT present: "Turn rough ideas into iron-clad work orders"
- [x] WHEN present: "when request is vague"
- [x] KEYWORDS present: "add a button", "make it better", "fix the thing"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add eval cases with vague vs clear input examples
2. Consider adding "Common Rationalizations" for consistency

**Verdict**
SHIP - Strong clarification protocol.

---

### hope:breakthrough

**Summary**
- Score: 96/120 (Good)
- Knowledge Delta: [A]ctivation - Creative problem-solving techniques
- Pattern Match: Navigation → Navigation (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 14/15 | Clear: "Structured creativity when conventional approaches fail" |
| Knowledge Delta | 15/20 | Solid [A]: 6 techniques with symptom dispatch |
| Description Quality | 14/15 | WHAT ✓, WHEN ✓, KEYWORDS ✓ |
| Progressive Disclosure | 13/15 | 156 lines; techniques in references (good) |
| Freedom Calibration | 14/15 | Appropriate medium freedom for creative tasks |
| Output Format | 9/10 | Clear output template |
| Anti-Pattern Coverage | 9/15 | "When NOT to Use" is good; no common rationalizations |
| Testability | 8/15 | Hard to test "breakthrough" but protocol is clear |

**Description Analysis**
- [x] WHAT present: "Creative problem-solving techniques when stuck"
- [x] WHEN present: "when progress has stalled"
- [x] KEYWORDS present: "stuck", "blocked", "can't figure out", "hitting a wall"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add example breakthrough scenario
2. Add "Common Rationalizations" for technique avoidance

**Verdict**
SHIP - Well-designed creative support skill.

---

### hope:skill-judge

**Summary**
- Score: 105/120 (Excellent)
- Knowledge Delta: [A]ctivation - Meta-skill for skill quality
- Pattern Match: Process → Process (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 15/15 | Perfect: "Evaluate skill quality before publishing" |
| Knowledge Delta | 18/20 | Strong [A]: 8-dimension framework + knowledge delta classification |
| Description Quality | 15/15 | All elements present and precise |
| Progressive Disclosure | 14/15 | Good reference split for deep guidance |
| Freedom Calibration | 13/15 | Appropriate constraints for evaluation |
| Output Format | 10/10 | Excellent templates for single and batch eval |
| Anti-Pattern Coverage | 13/15 | 9 anti-patterns well-documented |
| Testability | 7/15 | Meta-skills are hard to test objectively |

**Description Analysis**
- [x] WHAT present: "Evaluate skill quality using 8-dimension framework"
- [x] WHEN present: "when reviewing skills, before publishing, or auditing"
- [x] KEYWORDS present: "evaluate skill", "review skill", "skill quality", "audit skills"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None.

**Recommendations**
1. Add example evaluation for a real skill
2. Could include borderline cases for score calibration

**Verdict**
SHIP - Excellent meta-skill, well-structured.

---

### counsel:counsel

**Summary**
- Score: 94/120 (Good)
- Knowledge Delta: [A]ctivation - Expert simulation framework
- Pattern Match: Navigation → Navigation (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 13/15 | Clear but complex: expert simulation + calibration |
| Knowledge Delta | 15/20 | Solid [A]: confidence calibration + guardrails |
| Description Quality | 13/15 | WHAT ✓, WHEN ✓, KEYWORDS ✓ (domain keywords) |
| Progressive Disclosure | 13/15 | 153 lines; heavy reference dependency |
| Freedom Calibration | 13/15 | Appropriate guardrails for simulation |
| Output Format | 9/10 | Confidence display format clear |
| Anti-Pattern Coverage | 10/15 | Guardrails good; could add common mistakes |
| Testability | 8/15 | Testable with expert queries but subjective |

**Description Analysis**
- [x] WHAT present: "Expert simulation for code guidance and style"
- [x] WHEN present: triggers listed in "When This Activates"
- [x] KEYWORDS present: "code like [expert]", "idiomatic", "best practice"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add "Common Rationalizations" for simulation overconfidence
2. Example output showing good vs bad confidence reporting

**Verdict**
SHIP - Unique skill with strong guardrails.

---

### founder:founder

**Summary**
- Score: 88/120 (Good)
- Knowledge Delta: [A]ctivation - Startup frameworks activation
- Pattern Match: Navigation/Router → Navigation (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 12/15 | Router pattern - delegates to workflows |
| Knowledge Delta | 14/20 | [A]: workflows are valuable, but skill itself is thin |
| Description Quality | 13/15 | WHAT ✓, WHEN ✓, KEYWORDS ✓ |
| Progressive Disclosure | 14/15 | 110 lines, good structure |
| Freedom Calibration | 12/15 | Router is appropriately light |
| Output Format | 8/10 | Artifact tooling clear |
| Anti-Pattern Coverage | 10/15 | "Common Rationalizations" present |
| Testability | 5/15 | Router testing is workflow testing |

**Description Analysis**
- [x] WHAT present: Implicit - startup workflows
- [x] WHEN present: "validating ideas, sizing markets..."
- [x] KEYWORDS present: "fundraising", "pitch", "TAM/SAM/SOM"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant. Router pattern is intentional.

**Recommendations**
1. Add brief guidance for when NO workflow matches
2. Link to thinking tools could be more actionable

**Verdict**
SHIP - Good router skill; value is in referenced workflows.

---

### career:career

**Summary**
- Score: 86/120 (Good)
- Knowledge Delta: [A]ctivation - Career development frameworks
- Pattern Match: Navigation/Router → Navigation (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 12/15 | Router pattern - delegates to workflows |
| Knowledge Delta | 13/20 | [A]: workflows valuable, skill itself thin |
| Description Quality | 13/15 | WHAT ✓, WHEN ✓, KEYWORDS ✓ |
| Progressive Disclosure | 14/15 | 89 lines, concise |
| Freedom Calibration | 12/15 | Router is appropriately light |
| Output Format | 7/10 | Quality Footer defined; workflow outputs vary |
| Anti-Pattern Coverage | 7/15 | No rationalizations section |
| Testability | 8/15 | Testable via workflow routing |

**Description Analysis**
- [x] WHAT present: Implicit - career development
- [x] WHEN present: "preparing for interviews, assessing skills..."
- [x] KEYWORDS present: "interview prep", "career assessment", "skill gaps"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add "Common Rationalizations" for career planning
2. Example: "I'll prepare for interviews later" → wrong

**Verdict**
SHIP - Functional router skill.

---

### product:product

**Summary**
- Score: 82/120 (Needs Work)
- Knowledge Delta: [A]ctivation - Product management frameworks
- Pattern Match: Navigation/Router → Navigation (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 12/15 | Router pattern - delegates to workflows |
| Knowledge Delta | 13/20 | [A]: workflows valuable, skill thin |
| Description Quality | 9/15 | Missing explicit WHEN in description |
| Progressive Disclosure | 14/15 | 68 lines, very concise |
| Freedom Calibration | 12/15 | Router is appropriately light |
| Output Format | 6/10 | Minimal format guidance |
| Anti-Pattern Coverage | 6/15 | No rationalizations, no anti-patterns |
| Testability | 10/15 | Testable via workflow routing |

**Description Analysis**
- [x] WHAT present: "Product workflows router"
- [~] WHEN present: "Use when user mentions..." but description lacks explicit triggers
- [x] KEYWORDS present: "PRD", "competitive analysis", "metrics"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
- #3 The Invisible Skill (LOW): Description could be clearer on WHEN

**Recommendations**
1. **PRIORITY**: Add explicit WHEN to description format
2. Add "Common Rationalizations" (e.g., "We'll add metrics later")
3. Add Quality Footer requirements like other router skills

**Verdict**
REVISE - Functional but description needs polish.

---

### wordsmith:writing

**Summary**
- Score: 84/120 (Good)
- Knowledge Delta: [A]ctivation - Writing frameworks
- Pattern Match: Navigation/Router → Navigation (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 12/15 | Router pattern for writing workflows |
| Knowledge Delta | 13/20 | [A]: editing workflows valuable |
| Description Quality | 13/15 | WHAT ✓, WHEN ✓, KEYWORDS ✓ |
| Progressive Disclosure | 14/15 | 63 lines, concise |
| Freedom Calibration | 12/15 | Router appropriately light |
| Output Format | 6/10 | Minimal format guidance |
| Anti-Pattern Coverage | 6/15 | Rules section thin |
| Testability | 8/15 | Testable via workflow routing |

**Description Analysis**
- [x] WHAT present: "Precision editing for prose and copy"
- [x] WHEN present: 'when user says "edit this", "improve this"'
- [x] KEYWORDS present: "edit this", "review my writing", "use [name]'s voice"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add "Common Rationalizations" for editing resistance
2. Expand Rules section with examples

**Verdict**
SHIP - Good router skill with clear triggers.

---

### wordsmith:template

**Summary**
- Score: 90/120 (Good)
- Knowledge Delta: [A]ctivation - Document scaffolding
- Pattern Match: Tool → Tool (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 13/15 | Clear: "Scaffold structured documents" |
| Knowledge Delta | 14/20 | Solid [A]: template management system |
| Description Quality | 10/15 | WHAT ✓, WHEN missing, KEYWORDS missing |
| Progressive Disclosure | 14/15 | 104 lines, well-structured |
| Freedom Calibration | 13/15 | Appropriate for templating |
| Output Format | 9/10 | JSONL schema clear |
| Anti-Pattern Coverage | 8/15 | Rules present but no explicit anti-patterns |
| Testability | 9/15 | Testable with template creation scenarios |

**Description Analysis**
- [x] WHAT present: "Scaffold structured documents"
- [ ] WHEN missing: No explicit "Use when..."
- [ ] KEYWORDS missing: No trigger phrases
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
- #3 The Invisible Skill (MEDIUM): Missing WHEN/KEYWORDS

**Recommendations**
1. **PRIORITY**: Add WHEN: "Use when writing RFC, ADR, design doc, or blog post"
2. Add KEYWORDS: "RFC template", "ADR format", "blog structure"
3. Add common mistakes section

**Verdict**
REVISE - Good skill but invisible. Fix description.

---

### design:design

**Summary**
- Score: 92/120 (Good)
- Knowledge Delta: [A]ctivation - Design exploration framework
- Pattern Match: Navigation → Navigation (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 13/15 | Clear exploration focus, NOT execution |
| Knowledge Delta | 14/20 | Solid [A]: anti-convergence, evidence-grounding |
| Description Quality | 13/15 | WHAT ✓, WHEN ✓, KEYWORDS implicit |
| Progressive Disclosure | 13/15 | 91 lines, good workflow table |
| Freedom Calibration | 14/15 | High freedom for exploration appropriate |
| Output Format | 8/10 | Workflow flow diagram helpful |
| Anti-Pattern Coverage | 9/15 | Core Principles act as guidelines |
| Testability | 8/15 | Design is inherently subjective |

**Description Analysis**
- [x] WHAT present: "Explore visual design, UI/UX, and design systems"
- [x] WHEN present: "when designing visual directions, user journeys..."
- [~] KEYWORDS: implicit in triggers, could add explicit phrases
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add explicit keywords: "design review", "color palette", "typography"
2. Add "Common Rationalizations" for premature convergence

**Verdict**
SHIP - Strong exploration-focused design skill.

---

### loop:start

**Summary**
- Score: 94/120 (Good)
- Knowledge Delta: [A]ctivation - Autonomous iteration framework
- Pattern Match: Process → Process (correct)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 14/15 | Clear: "Autonomous iteration until spec satisfied" |
| Knowledge Delta | 16/20 | Strong [A]: spec scoring, workflow shapes, circuit breakers |
| Description Quality | 14/15 | WHAT ✓, WHEN ✓, KEYWORDS ✓ |
| Progressive Disclosure | 13/15 | 105 lines, good reference use |
| Freedom Calibration | 13/15 | Tool/Colleague shapes handle freedom well |
| Output Format | 8/10 | Task API format clear |
| Anti-Pattern Coverage | 8/15 | Stop conditions good; could add rationalizations |
| Testability | 8/15 | Testable but requires multi-turn simulation |

**Description Analysis**
- [x] WHAT present: "Start autonomous iteration loop"
- [x] WHEN present: "when user requests 'loop', 'keep going'"
- [x] KEYWORDS present: "loop", "continue until done", "fix all problems"
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
None significant.

**Recommendations**
1. Add "Common Rationalizations" for loop abuse
2. Example: "Just keep going forever" → circuit breakers exist for a reason

**Verdict**
SHIP - Well-designed autonomous iteration skill.

---

### loop:cancel

**Summary**
- Score: 58/120 (Significant Issues)
- Knowledge Delta: [A]ctivation - Simple cancellation
- Pattern Match: Tool → Tool (correct but too simple)

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 10/15 | Clear but trivial |
| Knowledge Delta | 8/20 | Weak [A]: cancellation is straightforward |
| Description Quality | 5/15 | WHAT only: "Cancel active Loop" |
| Progressive Disclosure | 12/15 | 34 lines, concise (but too thin) |
| Freedom Calibration | 10/15 | Appropriate for simple action |
| Output Format | 8/10 | Output template clear |
| Anti-Pattern Coverage | 0/15 | No anti-patterns |
| Testability | 5/15 | Trivial to test |

**Description Analysis**
- [x] WHAT present: "Cancel active Loop"
- [ ] WHEN missing: When should user cancel?
- [ ] KEYWORDS missing: No trigger phrases
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
- #3 The Invisible Skill (HIGH): Missing WHEN/KEYWORDS
- Near #1 Tutorial: Almost too simple to need a skill

**Recommendations**
1. **CRITICAL**: Add WHEN: "Use when loop is running but task changed, stuck, or no longer needed"
2. Add KEYWORDS: "stop loop", "abort", "end iteration"
3. Consider merging into loop:start as a section (cancellation protocol)

**Verdict**
REVISE - Too thin for standalone skill; needs enrichment or merge.

---

### loop:help

**Summary**
- Score: 62/120 (Significant Issues)
- Knowledge Delta: [R]edundant - Basic documentation
- Pattern Match: N/A → Should be documentation, not skill

**Dimension Scores**

| Dimension | Score | Notes |
| --------- | ----- | ----- |
| Problem Definition | 8/15 | "Explain plugin" is documentation, not skill |
| Knowledge Delta | 5/20 | [R]edundant: help text is basic |
| Description Quality | 6/15 | WHAT only, no WHEN/KEYWORDS |
| Progressive Disclosure | 13/15 | 44 lines, clean |
| Freedom Calibration | 10/15 | N/A for documentation |
| Output Format | 8/10 | Clear command table |
| Anti-Pattern Coverage | 4/15 | Tips section is weak guidance |
| Testability | 8/15 | Trivial - just output help text |

**Description Analysis**
- [x] WHAT present: "Explain Loop plugin and available commands"
- [ ] WHEN missing
- [ ] KEYWORDS missing
- [x] Under 1024 characters
- [x] No multi-line YAML blocks

**Anti-Patterns Detected**
- #1 The Tutorial (MEDIUM): Explains what Claude should already know from loop:start
- Near-[R]edundant: Help systems are built into Claude Code

**Recommendations**
1. Consider deleting: /help is built-in, plugin.json has description
2. If kept: merge into loop:start as "## Help" section
3. If kept standalone: add real value beyond command listing

**Verdict**
REVISE - Borderline redundant. Merge or delete.

---

## Appendix: Scoring Reference

### Score Interpretation
| Score | Verdict | Action |
| ----- | ------- | ------ |
| 100-120 | Excellent | Ship |
| 80-99 | Good | Ship with minor tweaks |
| 60-79 | Needs work | Revise before publishing |
| 40-59 | Significant issues | Major redesign needed |
| < 40 | Fundamental problems | Reconsider if skill is needed |

### Knowledge Delta Legend
- [E]xpert: Domain expertise Claude lacks
- [A]ctivation: Knowledge Claude has but needs prompting
- [R]edundant: Already in Claude's base capabilities

### Anti-Pattern Severity
| Severity | Action |
| -------- | ------ |
| Critical | Cannot ship (#3 Invisible, #9 Kitchen Sink) |
| High | Revise before ship (#1 Tutorial, #2 Dump, #4 Mismatch) |
| Medium | Should fix (#5 Chains, #6 Generic, #8 Monologue) |
| Low | Nice to fix (#7 Over-Engineering) |
