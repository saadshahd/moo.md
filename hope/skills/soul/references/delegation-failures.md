# Delegation Failure Library

Common failure patterns that inform future scoring. Reference when reviewing past delegation issues or calibrating fit scores.

---

## Shape Mismatch Failures

### Premature Tool-Shape

**Symptom:** Output misses mark entirely, requires complete rework

**Root Cause:** Fit score borderline (35-39), chose Tool instead of Colleague

**Prevention:** If fit 35-45, default to Colleague even if total suggests Tool

**Learning Category:** `delegation-shape-mismatch`

**Example:**
> Spec: "Improve the onboarding flow"
> Fit score: 37 (borderline)
> Chose: Tool-shaped (fire-and-forget)
> Result: Completely redesigned flow instead of targeted improvements

### Forced Colleague When Tool Fits

**Symptom:** Excessive check-ins, slow progress, frustration

**Root Cause:** Low trust or past failures caused overcorrection

**Prevention:** If fit ≥40 and verification < 5 min, trust Tool-shape

**Learning Category:** `delegation-shape-mismatch`

---

## Specification Failures

### Undefined Verification

**Symptom:** "I'll know it when I see it" → "this isn't what I wanted"

**Root Cause:** No verification method defined upfront

**Prevention:** Require verification type before proceeding. Block on "assumption"

**Learning Category:** `delegation-verification-gap`

**Example:**
> Spec: "Make the API faster"
> Verification: "I'll check if it feels faster"
> Result: 40% latency reduction achieved, but user wanted throughput

### Missing Must-NOT Criteria

**Symptom:** Output has unrequested features or "helpful" additions

**Root Cause:** No explicit constraints on what NOT to do

**Prevention:** Require 2+ must-NOT criteria for any non-trivial task

**Learning Category:** `delegation-scope-creep`

**Example:**
> Spec: "Add dark mode toggle"
> Must-NOT: (none specified)
> Result: Also refactored theme system, added system preference detection, created new components

### Ambiguous Success Criteria

**Symptom:** Output technically correct but wrong

**Root Cause:** Multiple valid interpretations of spec

**Prevention:** Run adversarial pre-check for high stakes (Reversibility < 5)

**Learning Category:** `delegation-ambiguity`

**Example:**
> Spec: "Users should be able to export their data"
> Interpretation A: CSV export button
> Interpretation B: GDPR-compliant data portability endpoint
> Interpretation C: Backup/restore functionality

---

## Execution Failures

### Invented API

**Symptom:** Code references non-existent libraries, methods, or endpoints

**Root Cause:** Confidence too high without verification, no library search

**Prevention:** Library search mandatory. Verify APIs exist before using

**Learning Category:** `delegation-hallucination`

### Hallucinated Content

**Symptom:** Facts, quotes, or data that don't exist

**Root Cause:** Treated AI output as authoritative without fact-checking

**Prevention:** Require citations for factual claims. Verify before trusting

**Learning Category:** `delegation-hallucination`

### Wrong Audience

**Symptom:** Content pitched at wrong technical/expertise level

**Root Cause:** Audience not explicitly specified

**Prevention:** Include explicit audience in spec with examples of their knowledge level

**Learning Category:** `delegation-context-gap`

---

## Systemic Failures

### Survivorship Bias in Delegation

**Symptom:** Tool-shaped tasks succeed, conclude "delegation works"

**Root Cause:** Only easy tasks delegated; hard ones kept manual

**Prevention:** Track colleague-shaped outcomes too. Calibrate on full distribution

**Learning Category:** `delegation-measurement-bias`

### Incomplete Migration

**Symptom:** New system works but old system also exists

**Root Cause:** Task framed as "add X" instead of "replace Y with X"

**Prevention:** Include explicit cleanup/removal in acceptance criteria

**Learning Category:** `delegation-scope-creep`

### Constraint Conflict

**Symptom:** Output satisfies some constraints but violates others

**Root Cause:** Constraints weren't checked for mutual compatibility

**Prevention:** Run adversarial pre-check to find conflicts before starting

**Learning Category:** `delegation-ambiguity`

---

## Quick Reference

| Pattern | Key Signal | Gate |
|---------|------------|------|
| Shape mismatch | Fit 35-45 + chose Tool | Default to Colleague |
| Undefined verification | "assumption" type | Block until defined |
| Missing must-NOTs | Scope creep in output | Require 2+ constraints |
| Ambiguity | Multiple valid readings | Adversarial pre-check |
| Hallucination | Invented references | Library search + verify |
| Wrong audience | Mismatched tone/depth | Explicit audience in spec |
| Incomplete migration | Parallel systems | Cleanup in acceptance |

---

## Using This Library

**Before delegation:** Scan for applicable patterns. Tighten spec if risk is high.

**After miss:** Identify pattern and update `~/.claude/learnings/delegation.jsonl`

**When scoring:** Past failures in domain should lower fit score
