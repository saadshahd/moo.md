# Anchor Experts

Conflict resolution hierarchy for when experts disagree.

---

## The Anchor Principle

When experts provide conflicting recommendations, defer to **anchor experts** who embody core engineering values:

1. **Rich Hickey** — Simplicity, immutability, explicit over implicit
2. **Martin Fowler** — Pragmatism, evolutionary design, patterns in context

Ask: "What would Hickey say about this complexity?"
Then: "What would Fowler say about this trade-off?"

---

## Anchor Hierarchy

```
Hickey (simplicity)
    ↓
Fowler (pragmatism)
    ↓
Domain expert (context)
    ↓
Simpler option (default)
```

When in doubt, pick the simpler option.

---

## Anchors by Aspect

| Aspect | Primary Anchor | Tiebreaker Logic |
|--------|----------------|------------------|
| Data/Schema | Hickey | "Is this the simplest shape that works?" |
| Architecture | Fowler | "Does this allow evolutionary change?" |
| API Design | Fowler | "Is this a resource or an RPC?" |
| State Mgmt | Hickey | "Can this be immutable?" |
| Performance | Hickey | "Is this complexity necessary?" |
| Error Handling | Hickey | "Is the error path explicit?" |
| Testing | Feathers | "Where are the seams?" |
| Visual/UI | Norman | "Does this match mental models?" |
| User Flows | Norman | "Is recovery from error possible?" |
| Domain Logic | Fowler | "Is the language ubiquitous?" |

---

## Hickey's Anchor Questions

When routing through Hickey, ask:

**On complexity**:
> "Simple is not easy. Is this genuinely simple, or just familiar?"

**On state**:
> "What if this were immutable? What would break?"

**On abstraction**:
> "Does this abstraction complect things that should be separate?"

**On data**:
> "Is this the data, or is this the place where the data lives?"

**On time**:
> "Am I modeling time explicitly, or hiding it?"

---

## Fowler's Anchor Questions

When routing through Fowler, ask:

**On patterns**:
> "Is this a pattern, or am I adding accidental complexity?"

**On architecture**:
> "Can I change this later without a rewrite?"

**On domain**:
> "What does the domain expert call this?"

**On trade-offs**:
> "What am I trading, and is it worth it?"

**On refactoring**:
> "Can I get there incrementally, or does this require a big bang?"

---

## Conflict Resolution Examples

### Example 1: API Response Shape

**Expert A** (REST purist): Nest resources deeply
```json
{
  "user": {
    "posts": [{ "comments": [...] }]
  }
}
```

**Expert B** (Pragmatist): Flatten for client convenience
```json
{
  "user": {...},
  "posts": [...],
  "comments": [...]
}
```

**Hickey anchor**: "Which is simpler to reason about?"
- Flat structure is simpler to traverse
- No deep nesting to navigate
- **Pick: Flatten**

---

### Example 2: State Management

**Expert A**: Global state store (Redux pattern)
**Expert B**: Local component state (React state)

**Hickey anchor**: "Does this need to be shared?"
- If only one component uses it → local state
- If multiple components need it → lift minimally
- Global store only when truly global
- **Pick: Start local, lift when proven necessary**

---

### Example 3: Error Handling

**Expert A**: Throw exceptions, catch at boundary
**Expert B**: Return error values, check at each level

**Hickey anchor**: "Is the error path explicit?"
- Return values make error path visible
- Exceptions hide control flow
- **Pick: Return values (Result/Either pattern)**

---

### Example 4: Data Validation

**Expert A**: Validate in UI before submit
**Expert B**: Validate in API, return errors
**Expert C**: Validate in both

**Fowler anchor**: "Where does the truth live?"
- API is the authority (clients can be bypassed)
- UI validation is UX optimization, not truth
- **Pick: API is source of truth, UI validates for UX**

---

## Autonomous Mode Tiebreaker

When in autonomous mode (user away), conflicts must resolve without input.

**Protocol**:
1. Apply Hickey anchor (simplicity)
2. Apply Fowler anchor (pragmatism)
3. If still tied → pick option with fewer dependencies
4. Note the choice in SHAPE.md under "Autonomous Decisions"

```markdown
## Autonomous Decisions

Shape made the following choices without user input:

| Conflict | Options | Choice | Reasoning |
|----------|---------|--------|-----------|
| State management | Global vs Local | Local | Hickey: start simple |
| Error format | Exceptions vs Values | Values | Hickey: explicit path |
```

---

## When NOT to Anchor

Some conflicts are genuinely user preference:

- Visual style (color, typography)
- Framework choice (when multiple are valid)
- Testing philosophy (TDD vs test-after)

For these:
- Present mode: Ask user
- Autonomous mode: Pick established project convention, or simpler option

---

## Philosophy

> "Simplicity is a prerequisite for reliability." — Dijkstra

> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand." — Fowler

> "Programmers know the benefits of everything and the tradeoffs of nothing." — Hickey

The anchor experts cut through false trade-offs by asking fundamental questions. Most "hard choices" become obvious when you ask "is this actually necessary?"
