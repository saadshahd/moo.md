# Architecture Patterns

## Journey-Centric Design

Users reason in journeys, not components.

```
✗ Layer-First
/components/Button
/services/Auth  
/utils/Validation

✓ Journey-First
/journeys/checkout/
  CheckoutFlow.tsx
  PaymentProcessor.ts
  CheckoutValidation.ts
  index.ts
```

**Test:** Entire journey fits on one screen?

---

## Illegal States Unrepresentable

If it can't be expressed, it can't be broken.

```typescript
// ✗ Boolean soup (2^4 = 16 states, only 4 valid)
interface User {
  isLoggedIn: boolean;
  isLoading: boolean;
  username?: string;
  error?: string;
}

// ✓ Discriminated union (4 states, all valid)
type User =
  | { type: "anonymous" }
  | { type: "loading" }
  | { type: "authenticated"; username: string }
  | { type: "error"; message: string };
```

---

## Result Type (Railway-Oriented)

Errors as values, not exceptions.

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Pipeline composition
const pipeline = pipe(
  fetchData,           // Result<Data, FetchError>
  flatMap(validate),   // Result<Valid, ValidationError>
  flatMap(save)        // Result<Saved, SaveError>
);
```

---

## Progressive Disclosure

```
Layer 0: Simplest working version
  ↓ (only if metrics prove need)
Layer 1: Production ready
  ↓ (only if bottleneck measured)
Layer 2: Scale & optimize
```

Each layer requires metric-based justification.

---

## Cognitive Load Formula

```
Load = (Components × Complexity) − Journey Coherence
```

**Goal:** Entire system fits in one developer's head.

### Chunk Limits

- 3-5 concepts per module
- < 300 lines per file
- < 50 lines per function
- < 3 parameters per function

---

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `*Manager`, `*Helper` | Vague responsibility | Domain names |
| `try/catch` for control | Hidden flow | Result types |
| `interface_v2` | Cognitive split | Atomic migration |
| Nested ternary | Unreadable | Discriminated union |
| Boolean parameters | Unclear intent | Options object |
| > 2 callback levels | Cognitive overload | Pipeline/flatMap |
