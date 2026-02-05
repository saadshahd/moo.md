# Anchor Experts

Experts consulted for each implementation aspect.

## Hierarchy for Conflicts

When experts disagree, apply in order:

1. **Rich Hickey** — Simplicity wins. "Is this genuinely simple, or just familiar?"
2. **Martin Fowler** — Pragmatism. "Can I change this later without a rewrite?"
3. **Tie-breaker** — Pick option with fewer dependencies

---

## Expert Profiles

### Rich Hickey (Data, Simplicity)

**Philosophy:**
- Simple is not easy; simple is fewer complected things
- Facts don't change; place-oriented programming causes bugs
- Immutability is the default; mutability is the exception
- State is a value at a point in time

**Guidance:**
- Prefer data over objects
- Make illegal states unrepresentable
- Use immutable by default
- Separate identity from value

**Questions:**
- Is this genuinely simple, or just familiar?
- What is complected that could be separated?
- Can this be data instead of code?

**Code Example:**
```typescript
// ❌ Mutable, place-oriented (complex)
class UserAccount {
  status: "active" | "suspended";
  suspendedAt?: Date;
  suspend() { this.status = "suspended"; this.suspendedAt = new Date(); }
}

// ✅ Immutable, value-oriented (simple)
type UserAccount =
  | { type: "active"; user: User }
  | { type: "suspended"; user: User; suspendedAt: Date };

function suspend(account: ActiveAccount, at: Date): SuspendedAccount {
  return { type: "suspended", user: account.user, suspendedAt: at };
}
```

---

### Martin Fowler (API, Pragmatism)

**Philosophy:**
- Patterns are starting points, not destinations
- Refactoring is continuous, not an event
- Design for change, not for reuse
- Good enough is often good enough

**Guidance:**
- Evolutionary design over big upfront design
- Make the change easy, then make the easy change
- Strangler fig for migrations
- YAGNI — don't build what you don't need yet

**Questions:**
- Can I change this later without a rewrite?
- What's the simplest thing that could possibly work?
- Am I building for today or hypothetical tomorrow?

**Code Example:**
```typescript
// ❌ Big upfront design (over-engineered)
interface PaymentProcessor {
  process(payment: Payment): Promise<Result>;
  refund(id: string): Promise<Result>;
  subscribe(plan: Plan): Promise<Subscription>;
  cancelSubscription(id: string): Promise<void>;
}

// ✅ Evolutionary design (start simple)
async function processPayment(amount: number, method: string) {
  // Start here. Add refund() when you need it.
  return stripe.charges.create({ amount, source: method });
}
```

---

### Don Norman (UI, User Experience)

**Philosophy:**
- Design is about communication
- Affordances signal what's possible
- Feedback tells users what happened
- Constraints prevent errors

**Guidance:**
- Visibility of system status
- Match between system and real world
- User control and freedom
- Error prevention over error messages

**Questions:**
- What does this afford?
- How does the user know what happened?
- What errors can we prevent by design?

**Code Example:**
```tsx
// ❌ No affordance, no feedback
<button onClick={save}>💾</button>

// ✅ Clear affordance + feedback
<button
  onClick={save}
  disabled={!hasChanges}
  aria-label="Save changes"
>
  {saving ? "Saving..." : hasChanges ? "Save Changes" : "Saved ✓"}
</button>
```

---

### OWASP (Auth, Security)

**Philosophy:**
- Defense in depth
- Principle of least privilege
- Fail secure
- Never trust user input

**Guidance:**
- Validate all inputs
- Parameterize queries
- Hash passwords properly
- Log security events

**Questions:**
- What's the threat model?
- What's the blast radius if this fails?
- Is there an existing secure pattern?

**Code Example:**
```typescript
// ❌ SQL injection vulnerable
const user = await db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);

// ✅ Parameterized query
const user = await db.query("SELECT * FROM users WHERE id = $1", [req.params.id]);

// ❌ Trusts user input
if (req.body.isAdmin) grantAdmin(user);

// ✅ Validates at boundary
const { isAdmin } = adminSchema.parse(req.body); // throws if invalid
```

---

### Brendan Gregg (Performance)

**Philosophy:**
- Measure, don't guess
- USE method: Utilization, Saturation, Errors
- Latency is the queen metric
- Optimize the bottleneck, not the whole system

**Guidance:**
- Profile before optimizing
- Understand the critical path
- Cache deliberately, invalidate correctly
- Set SLOs before building

**Questions:**
- Where is the actual bottleneck?
- What does the flame graph show?
- Is this optimization premature?

**Code Example:**
```typescript
// ❌ Premature optimization (guessing)
const cache = new LRUCache({ max: 10000 }); // Why 10000?

// ✅ Measure first, then optimize
// 1. Profile: 80% of requests hit getUserById
// 2. Measure: avg 50ms DB query, 1000 req/min
// 3. Size cache: 1000 users × 5min TTL = 5000 entries
const cache = new LRUCache({ max: 5000, ttl: 300_000 });
```

---

### Michael Nygard (Error, Resilience)

**Philosophy:**
- Failures are inevitable; plan for them
- Stability patterns: circuit breakers, bulkheads, timeouts
- Systems fail at their boundaries
- Cynical software assumes calls will fail

**Guidance:**
- Set timeouts everywhere
- Use circuit breakers for external calls
- Bulkhead isolation for critical paths
- Fail fast, recover slow

**Questions:**
- What happens when this fails?
- Is there a fallback?
- Can failures cascade?

**Code Example:**
```typescript
// ❌ Optimistic (will cascade failures)
const user = await fetchUserFromService(id);
const orders = await fetchOrdersFromService(user.id);

// ✅ Cynical with circuit breaker
const user = await circuitBreaker.fire(() =>
  fetchUserFromService(id, { timeout: 2000 })
).catch(() => cachedUser(id) ?? { id, name: "Unknown" });
```

---

### Kent Beck (Testing)

**Philosophy:**
- Test behavior, not implementation
- Make it work, make it right, make it fast
- Tests are documentation
- Red-green-refactor

**Guidance:**
- Test the public interface
- One assertion per test
- Arrange-Act-Assert
- Test should tell a story

**Questions:**
- What behavior am I testing?
- Can I delete this test after refactoring?
- Does this test document intent?

**Code Example:**
```typescript
// ❌ Testing implementation (brittle)
test("calls validateEmail then hashPassword", () => {
  const spy1 = jest.spyOn(utils, "validateEmail");
  const spy2 = jest.spyOn(utils, "hashPassword");
  createUser(data);
  expect(spy1).toHaveBeenCalledBefore(spy2);
});

// ✅ Testing behavior (robust)
test("rejects invalid email addresses", () => {
  expect(() => createUser({ email: "not-an-email" }))
    .toThrow("Invalid email");
});
```

---

### Sam Newman (Migration)

**Philosophy:**
- Incremental > big bang
- Strangler fig pattern
- Feature toggles for safety
- Seams are your friend

**Guidance:**
- Find seams for safe changes
- Use branch by abstraction
- Parallel run before cutover
- Have a rollback plan

**Questions:**
- Can we do this incrementally?
- What's the rollback plan?
- Where are the seams?

**Code Example:**
```typescript
// ❌ Big bang migration
// Day 1: Delete old auth, deploy new auth (pray)

// ✅ Strangler fig pattern
const getUser = async (id: string) => {
  if (featureFlag("new-auth")) {
    return newAuthService.getUser(id);  // New system
  }
  return legacyAuth.getUser(id);  // Old system
};
// Gradually shift traffic, rollback = flip flag
```

---

### Gregor Hohpe (Integration)

**Philosophy:**
- Messaging decouples in time and space
- Idempotent consumers
- Correlation IDs for tracing
- Don't distribute your objects

**Guidance:**
- Prefer events over commands
- Make operations idempotent
- Track request correlation
- Document contracts explicitly

**Questions:**
- Is this really a synchronous call?
- What if this message is delivered twice?
- How do we trace across services?

**Code Example:**
```typescript
// ❌ Not idempotent (breaks on retry)
async function processPayment(orderId: string) {
  await chargeCard(orderId);
  await db.orders.update(orderId, { paid: true });
}

// ✅ Idempotent with correlation
async function processPayment(orderId: string, correlationId: string) {
  const existing = await db.payments.findBy({ correlationId });
  if (existing) return existing; // Already processed

  const result = await chargeCard(orderId, { idempotencyKey: correlationId });
  await db.payments.create({ orderId, correlationId, result });
  return result;
}
```

---

### Jez Humble (Deployment)

**Philosophy:**
- If it hurts, do it more often
- Trunk-based development
- Feature flags over branches
- Deployments should be boring

**Guidance:**
- Continuous delivery
- Blue-green or canary deployments
- Feature flags for risk mitigation
- Rollback in seconds, not hours

**Questions:**
- Can we roll this back in minutes?
- Should this be behind a flag?
- Is this deployment reversible?

**Code Example:**
```typescript
// ❌ Long-lived feature branch (merge pain)
// git checkout -b feature/new-checkout  // 3 weeks later...

// ✅ Trunk-based with feature flag
// main branch, always deployable
export function Checkout() {
  if (featureFlag("new-checkout", { user })) {
    return <NewCheckout />;  // Progressive rollout
  }
  return <LegacyCheckout />;  // Safe fallback
}
```

---

## Using Experts

### During Shaping

1. Identify relevant aspects
2. Look up anchor expert for each
3. Apply their questions to the spec
4. Document recommendations with confidence

### On Conflict

1. Document both positions
2. Apply hierarchy (Hickey → Fowler → fewer deps)
3. Record reasoning for future reference

### Output Format

```markdown
| Aspect | Expert | Recommendation | Confidence |
|--------|--------|----------------|------------|
| Data | Hickey | Immutable event log | 90% |
| API | Fowler | REST, no GraphQL yet | 80% |
| UI | Norman | Progressive disclosure | 75% |
```
