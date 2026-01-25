# Property Testing

## When to Apply

Auto-detect opportunities when code involves:
- Serialize/deserialize operations
- Encode/decode transformations
- Normalize/denormalize data
- Parse/stringify conversions
- Any bidirectional transformation

---

## Property Catalog

### Roundtrip Properties

```
decode(encode(x)) == x
parse(stringify(x)) == x
deserialize(serialize(x)) == x
```

Use when: Data transformation should be lossless

### Idempotence Properties

```
f(f(x)) == f(x)
normalize(normalize(x)) == normalize(x)
format(format(x)) == format(x)
```

Use when: Repeated application should have no additional effect

### Invariant Properties

```
sorted(x).length == x.length
validate(transform(valid_input)) == true
hash(x).length == 64  // constant output size
```

Use when: Some property must hold after any transformation

### Commutativity Properties

```
f(g(x)) == g(f(x))
merge(a, merge(b, c)) == merge(merge(a, b), c)
union(A, B) == union(B, A)
```

Use when: Order shouldn't matter

### Oracle Properties

```
new_implementation(x) == known_correct_implementation(x)
optimized_sort(x) == stdlib_sort(x)
```

Use when: Rewriting existing functionality

### Metamorphic Properties

```
sort(reverse(x)) == sort(x)
count(filter(x, p)) <= count(x)
sum(map(x, double)) == 2 * sum(x)
```

Use when: Can't know exact output but know relationships

---

## Property Strength Hierarchy

From weakest to strongest:

1. **Smoke**: Function doesn't crash
2. **Type**: Returns expected type
3. **Invariant**: Maintains stated property
4. **Roundtrip**: Bidirectional correctness
5. **Oracle**: Matches known-correct implementation

Target the strongest property your situation allows.

---

## Library Recommendations

| Language | Library | Notes |
|----------|---------|-------|
| JavaScript/TS | fast-check | Most popular, good shrinking |
| Python | hypothesis | Excellent, integrates with pytest |
| Rust | proptest | Powerful, good macros |
| Go | rapid | Simple, effective |
| Haskell | QuickCheck | The original |
| Elixir | StreamData | Built into ExUnit |
| Java/Kotlin | jqwik | JUnit 5 integration |

---

## Writing Good Generators

```typescript
// Bad: Only tests edge cases you thought of
const testCases = ["", "hello", "a".repeat(1000)]

// Good: Explores space you didn't imagine
const stringArb = fc.string({ minLength: 0, maxLength: 10000 })

// Better: Domain-specific generator
const emailArb = fc.tuple(
  fc.string({ minLength: 1 }),
  fc.constantFrom("gmail.com", "company.co", "test.org")
).map(([local, domain]) => `${local}@${domain}`)
```

---

## Shrinking

Property testing's superpower: when a test fails, the framework minimizes the input to the simplest failing case.

```
Test fails on: [1, 7, 3, 9, 2, 4]
Shrinks to:    [7]
```

The minimal case IS the bug report. Don't disable shrinking.

---

## Integration Pattern

Property tests complement, don't replace, example tests:

| Test Type | Purpose |
|-----------|---------|
| Example tests | Document expected behavior |
| Property tests | Find unexpected edge cases |

```typescript
describe("JSON roundtrip", () => {
  it("preserves known values", () => {
    expect(parse(stringify({ a: 1 }))).toEqual({ a: 1 });
  });

  it("preserves arbitrary objects", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(parse(stringify(value))).toEqual(value);
      })
    );
  });
});
```

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Too many runs slow CI | Start with 100 runs, increase for critical paths |
| Flaky tests from randomness | Use deterministic seed in CI |
| Generator doesn't match domain | Constrain generator to valid inputs |
| Property too weak to catch bugs | Strengthen property hierarchy |
| Ignoring shrunk output | The minimal case reveals the bug |

---

## Quick Start Template

```typescript
import fc from "fast-check";

describe("MyFunction", () => {
  it("roundtrips correctly", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(decode(encode(input))).toBe(input);
      }),
      { numRuns: 1000 }
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const once = normalize(input);
        const twice = normalize(once);
        expect(twice).toBe(once);
      })
    );
  });
});
```

---

## Decision: When to Use

| Situation | Property Testing Value |
|-----------|----------------------|
| Serialization layer | High - roundtrip properties |
| Pure transformations | High - metamorphic properties |
| Algorithm rewrites | High - oracle properties |
| UI components | Low - visual testing better |
| Integration tests | Low - example tests clearer |
| Database operations | Medium - invariant properties |
