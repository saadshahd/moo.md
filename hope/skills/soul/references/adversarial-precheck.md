# Adversarial Pre-Check

Run before high-stakes delegations: Reversibility < 5 OR customer-facing.

---

## When Required

| Condition | Trigger |
|-----------|---------|
| Reversibility score < 5 | Schema changes, public APIs, published content |
| Customer-facing | User-visible features, external communications |
| High cost of rework | Data migrations, architectural decisions |
| Regulatory | Compliance-related changes |

---

## Protocol

1. **Write the spec** (or review existing spec)

2. **Attack the spec**: "How would a careless AI misinterpret this?"

3. **List 3-5 plausible misinterpretations** (see Attack Strategies below)

4. **Tighten spec** to eliminate each vulnerability

5. **Re-score fit decision** with amended spec

---

## Attack Strategies

| Attack | Question to Ask |
|--------|-----------------|
| Scope Creep | What "helpful" additions might it invent? |
| Alternative Reading | What's another valid interpretation? |
| Edge Case Miss | What inputs/scenarios aren't covered? |
| False Completion | How could it pass criteria but be wrong? |
| Constraint Conflict | Which constraints might contradict each other? |
| Invented Solution | What non-existent APIs/libraries might it assume? |
| Wrong Audience | Who might it think this is for? |

---

## Output Format

For each vulnerability found:

```markdown
### Vulnerability: [Name]

**Spec text that enables it:**
> [Quote the problematic part]

**Plausible misinterpretation:**
[How AI could reasonably read this wrong]

**Amended spec text:**
> [Revised wording that closes the gap]

**New acceptance criterion (if needed):**
- [ ] [Specific check that catches this]
```

---

## Example

**Original spec:** "Add user authentication to the app"

### Vulnerability: Scope ambiguity

**Spec text that enables it:**
> "Add user authentication"

**Plausible misinterpretation:**
- OAuth vs password-based vs magic link
- Full auth system vs integration with existing
- Session-based vs token-based

**Amended spec text:**
> "Add email/password authentication using NextAuth.js, integrating with existing Prisma User model"

**New acceptance criterion:**
- [ ] Users can sign up with email and password
- [ ] Users can sign in with existing credentials
- [ ] Sessions persist across page refreshes
- [ ] Must NOT add OAuth providers

---

## Quick Checklist

Before high-stakes delegation:

```
□ Spec reviewed for ambiguity
□ 3-5 misinterpretations identified
□ Spec tightened to close gaps
□ At least 2 must-NOT criteria exist
□ Fit score recalculated
□ Verification method is not "assumption"
```

---

## When to Skip

Safe to skip adversarial pre-check when ALL true:

- Reversibility ≥ 7 (can easily undo)
- Not customer-facing
- Fit score ≥ 40
- Similar tasks have succeeded before
