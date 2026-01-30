# Aspect Discovery

How to identify which aspects of implementation need expert consultation.

---

## Discovery Process

Analyze the intent output for signals that indicate each aspect:

```
For each potential aspect:
  1. Check intent for keywords/signals
  2. Check if aspect is relevant to this task
  3. If relevant → add to consultation list
  4. If not relevant → skip (don't force)
```

---

## Aspect Signals

### Visual/UI

**Signals in intent**:
- "display", "show", "render", "view"
- "form", "input", "button", "modal"
- "list", "table", "card", "grid"
- "page", "screen", "component"
- Any user-facing output

**Questions to answer**:
- What does the user see?
- What are the interaction patterns?
- What happens in empty/loading/error states?

**Route to**: Norman (UX), Wathan (CSS), Soueidan (accessibility)

---

### Data/Schema

**Signals in intent**:
- "store", "save", "persist", "database"
- "model", "entity", "record", "schema"
- "relationship", "foreign key", "reference"
- Any noun that needs to exist over time

**Questions to answer**:
- What is the shape of the data?
- What constraints must be enforced?
- How do entities relate?

**Route to**: Hickey (data philosophy), Fowler (DDD)

---

### API/Interface

**Signals in intent**:
- "endpoint", "route", "API"
- "request", "response", "payload"
- "REST", "GraphQL", "RPC"
- "fetch", "call", "send"

**Questions to answer**:
- What are the exact endpoints?
- What shapes go in and out?
- How are errors communicated?

**Route to**: Fowler (architecture), Willison (pragmatic)

---

### Security

**Signals in intent**:
- "auth", "login", "permission", "role"
- "password", "token", "session"
- "private", "protected", "secure"
- Any user identity or access control

**Questions to answer**:
- Who can do what?
- How is identity verified?
- What data is sensitive?

**Route to**: Inferred security expert (counsel inference)

---

### User Flows

**Signals in intent**:
- "flow", "journey", "process", "wizard"
- "step", "stage", "sequence"
- "onboarding", "checkout", "signup"
- Multi-step interactions

**Questions to answer**:
- What are the steps?
- What happens at each transition?
- How does user recover from errors?

**Route to**: Norman (UX), Cagan (product)

---

### Domain Logic

**Signals in intent**:
- Business rules, calculations, validations
- Domain-specific terminology
- "when X then Y", "must be", "cannot be"
- Anything that's true regardless of UI/storage

**Questions to answer**:
- What are the invariants?
- What calculations/transformations?
- What's the ubiquitous language?

**Route to**: Fowler (DDD), domain expert (inferred)

---

### State Management

**Signals in intent**:
- "state", "store", "context"
- "update", "sync", "real-time"
- Complex UI with shared state
- Optimistic updates, caching

**Questions to answer**:
- Where does state live?
- How does it flow?
- What's the update strategy?

**Route to**: Hickey (immutability), Abramov (Redux patterns)

---

### Performance

**Signals in intent**:
- "fast", "quick", "instant"
- "scale", "load", "concurrent"
- "cache", "optimize", "lazy"
- Large data sets, real-time requirements

**Questions to answer**:
- What are the latency requirements?
- Where are the bottlenecks?
- What can be cached/deferred?

**Route to**: Hickey (simplicity), Osmani (web perf)

---

### Error Handling

**Signals in intent**:
- "error", "fail", "exception"
- "retry", "recover", "fallback"
- "validate", "reject", "invalid"
- Anything that can go wrong

**Questions to answer**:
- What errors are possible?
- How does user learn about them?
- What's the recovery path?

**Route to**: Hickey (explicit errors), Majors (observability)

---

### Testing

**Signals in intent**:
- "test", "verify", "validate"
- "coverage", "regression", "TDD"
- Complex logic that needs confidence

**Questions to answer**:
- What must be tested?
- What's the testing strategy?
- Where are the seams?

**Route to**: Feathers (legacy/seams), Fowler (TDD)

---

### Integration

**Signals in intent**:
- External service names (Stripe, Twilio, etc.)
- "webhook", "callback", "sync"
- "third-party", "external", "integration"
- Any system outside your control

**Questions to answer**:
- What's the contract?
- How do you handle their failures?
- What's the fallback?

**Route to**: Inferred integration expert

---

### Accessibility

**Signals in intent**:
- "accessible", "a11y", "WCAG"
- "screen reader", "keyboard"
- Any public-facing UI

**Note**: Often implicit. If Visual/UI is discovered, Accessibility should usually follow.

**Questions to answer**:
- Is it keyboard navigable?
- Does it work with screen readers?
- Is color sufficient for information?

**Route to**: Soueidan (CSS/a11y), Norman (UX)

---

## Discovery Output

After scanning intent, produce aspect list:

```
Discovered aspects:
• Visual/UI — Norman (primary), Wathan (CSS)
• Data/Schema — Hickey
• API Design — Fowler
• Error Handling — Hickey

Not applicable:
• Security (no auth in scope)
• Performance (no scale requirements)
• Integration (no external services)
```

Only shape discovered aspects. Don't force-fit aspects that aren't relevant.

---

## Aspect Combinations

Common patterns:

| Task Type | Typical Aspects |
|-----------|-----------------|
| CRUD feature | Visual, Data, API, Error |
| Auth system | Security, Data, API, User Flows |
| Dashboard | Visual, Data, Performance, State |
| Form wizard | Visual, User Flows, Validation, Error |
| API-only | Data, API, Error, Testing |
| Refactor | Testing, Domain Logic |

Match complexity to task. Simple task = fewer aspects.
