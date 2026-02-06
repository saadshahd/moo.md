# PHILOSOPHY.md

moo — thinking infrastructure for AI work.

Encodes good judgment as system behavior so it applies automatically — especially when pressure makes you forget.

---

## Beliefs

### 1. Better thinking and mistake prevention are inseparable

Quality output requires quality thinking before it. There is no separate "safety" concern — think well and mistakes don't happen. Think poorly and no amount of testing saves you.

### 2. Humans skip good thinking under pressure

People know they should clarify intent, verify work, consider alternatives. They skip all of it when stakes are high or deadlines close. moo encodes these habits as infrastructure so they apply automatically.

### 3. Solo thinking has blind spots

Every individual has systematic blind spots — domain biases, recency bias, confirmation bias. Multiple expert perspectives are the cure. Not access to knowledge (that's what search engines do) — access to different ways of seeing the same problem.

### 4. The right AI involvement depends on context

A debugging session needs different thinking than a greenfield build. A user who knows exactly what they want needs different engagement than one exploring. One framework that reads the room, not four separate tools.

---

## Principles

Each principle has a stance and a reason. Derived from beliefs above.

### From belief 2: Humans skip under pressure

- **Automatic over remembered** — If humans forget it under pressure, encode it. Cognitive load degrades judgment. Willpower fails. Infrastructure doesn't.

- **Clarity before action** — ≥85% confident or ask. Rework always costs more than clarification.

### From belief 1: Thinking = prevention

- **Depth over surface** — Five Whys, not quick fixes. Symptoms recur when root causes persist.

- **Investigation before implementation** — Never combine "find" + "fix" in one task. Mixing cognitive modes degrades both.

### From belief 3: Perspectives prevent blindness

- **Multiple perspectives over solo judgment** — Expert lenses catch what one mind misses. Blind spots are systematic, not random. You can't see your own.

- **Proven over invented** — Named frameworks with evidence. Novel methodology is untested. Knowledge compounds on shoulders of giants.

### From belief 4: Fluid AI involvement

- **Adapt to context** — Session type and engagement level shape system behavior. Build ≠ Debug ≠ Plan ≠ Reflect. One size fits none.

### Cross-cutting

- **Signal over noise** — Filter what matters from what screams loudest. Attention is finite. Overwhelm causes paralysis.

- **Machine-verifiable over ambiguous** — Criteria must be boolean. Ambiguity lets you fool yourself into "done."

- **Stateless** — Conversation is the only state. No persistent files. Hidden state creates invisible dependencies. What you see is what there is.

- **Simplicity wins conflicts** — When perspectives disagree, bias toward simplicity, then pragmatism, then fewer dependencies. Complexity is debt. Every abstraction must justify its existence.

---

## Constraints

Rules for skill authors, derived from principles above.

- Every skill must have: named framework (not invented), evidence it works, clear trigger condition, provenance documented
- Machine-verifiable exit criteria for every workflow
- ≤200 lines per SKILL.md
- Self-contained: works without external files

---

## Structure

**hope** — single plugin, 5 skills:
- **soul** = session strategy + thinking framework
- **intent** = clarify WHAT
- **shape** = decide HOW (consult-driven)
- **loop** = execute + verify + complete
- **consult** = expert simulation (42 profiles)
