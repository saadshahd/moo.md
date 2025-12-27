# Steel Man

Argue against the strongest version of opposing positions.

## When to Use

| Trigger                             | Use This Tool                  |
| ----------------------------------- | ------------------------------ |
| "Their argument is obviously wrong" | Before critiquing any position |
| Code review disagreement            | Ensure fair evaluation         |
| Design debate getting heated        | Find strongest opposing case   |
| Writing a rebuttal                  | Avoid attacking weak version   |

## The Framework

```
    WEAK ARGUMENTS                    STRONG ARGUMENTS
    ──────────────                    ────────────────

    ┌─────────────┐                   ┌─────────────┐
    │  STRAW MAN  │                   │  STEEL MAN  │
    │             │                   │             │
    │ Weaken      │       vs.         │ Strengthen  │
    │ opponent's  │                   │ opponent's  │
    │ position    │                   │ position    │
    └─────────────┘                   └─────────────┘
          │                                 │
          ▼                                 ▼
    Easy to defeat                    Hard to defeat
    but proves nothing                and earns respect

    ┌─────────────┐                   ┌─────────────┐
    │ HOLLOW MAN  │                   │  IRON MAN   │
    │             │                   │  (avoid)    │
    │ Fabricate   │                   │             │
    │ position    │                   │ Make YOUR   │
    │ no one      │                   │ position    │
    │ actually    │                   │ unfalsifiable│
    │ holds       │                   │             │
    └─────────────┘                   └─────────────┘
```

## How to Apply

**The Steel Man Process:**

1. **STATE** — Write their position in their words

   - Quote directly where possible
   - No paraphrasing that shifts meaning

2. **STRENGTHEN** — Re-express it better than they did

   - Add structure, remove ambiguity
   - Fill in implicit assumptions charitably

3. **STEELMAN** — Find the strongest version

   - What's the best evidence for their view?
   - What would a smart proponent say?

4. **VALIDATE** — Check your work

   - Would they say "I wish I'd put it that way"?
   - If not, you haven't steel-manned yet

5. **CRITIQUE** — Only now identify weaknesses

   - Attack the strong version, not the weak one
   - Your critique is now worth something

6. **TEST** — Ideological Turing Test
   - Could you argue their side so well that observers can't tell your real view?
   - If not, you don't understand their position yet

## Anti-Patterns

**Straw Man:** Misrepresent to easily defeat

- "So you're saying we should never write tests?"
- Reality: They said tests slow down prototyping

**Hollow Man:** Attack position no one holds

- "Some people think code quality doesn't matter"
- Reality: No serious developer believes this

**Iron Man:** Make your position unfalsifiable

- "My approach is more elegant" (no criteria)
- Better: Define specific, measurable tradeoffs

## Example

**Situation:** Code review comment says "We should use inheritance here instead of composition"

```
Your initial reaction (straw man):
───────────────────────────────────────────
"Inheritance is always bad. Composition over
inheritance is a fundamental principle."
───────────────────────────────────────────

Steel man process:
───────────────────────────────────────────
1. STATE: "Inheritance would let us share the
   validation logic across all payment types
   without repeating it in each class."

2. STRENGTHEN: "Payment types share 80% of
   validation. A base class would centralize
   this, make changes atomic, and IDE
   autocomplete would show available methods."

3. STEELMAN: "The strongest case is that our
   payment types ARE genuinely a hierarchy—
   CreditCard IS-A PaymentMethod—and the shared
   behavior is stable, not varying."

4. VALIDATE: Would they agree? Probably yes.

5. CRITIQUE: "The risk is that payment validation
   rules diverge over time. When CryptoPayment
   needs different validation, we either bloat
   the base class or break the hierarchy.
   Composition keeps each type independent."

6. TEST: Could I argue for inheritance?
   "Yes—if validation rules stay stable and
   we're optimizing for discoverability over
   flexibility, inheritance is simpler."
───────────────────────────────────────────
```

**Result:** Instead of dismissing their suggestion, you've engaged with its strongest form. Your critique is now credible, and you might even change your mind.

---

_Source: Daniel Dennett, "Intuition Pumps" (2013); Anatol Rapoport's Rules for Criticism_
