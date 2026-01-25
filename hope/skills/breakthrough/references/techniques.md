# Breakthrough Techniques

Six techniques for creative problem-solving when conventional approaches fail.

---

## 1. Simplification Cascade

Strip problem to essence, solve trivial version, add complexity back.

### Steps

1. **Strip to Core**: Remove every feature, constraint, edge case
2. **Solve Trivial**: Solve for the simplest possible case
3. **Add Incrementally**: Reintroduce complexity one piece at a time
4. **Find Break Point**: Note where difficulty jumps dramatically

### Example: Auth System Design

```
Stuck: Can't design auth system with SSO, MFA, roles, permissions, audit logs

Cascade:
1. Single user, hardcoded password → Trivial
2. Add password hashing → Standard library
3. Add multiple users → Database lookup
4. Add sessions → Cookie/JWT
5. Add roles → Permission table (complexity jumps here)
6. Add SSO → External provider integration
7. Add MFA → Second factor flow
8. Add audit → Event logging

Insight: The "auth system" is actually 4 separate problems.
Break down and solve sequentially.
```

### When to Use

- Problem feels too big to start
- Requirements list is overwhelming
- Can't find entry point

---

## 2. Scale Game

Test solutions at 1000x smaller and 1000x larger.

### Steps

1. **Shrink 1000x**: What if scale was trivial?
2. **Grow 1000x**: What if scale was massive?
3. **Compare Solutions**: Do they differ fundamentally?
4. **Find Invariant**: What must be true at any scale?

### Example: Database Performance

```
Stuck: Database queries are slow, uncertain where to optimize

Scale Game:
- 1 record: Instant. No optimization needed.
- 1M records: Need indexes. Which columns?
- 1B records: Need sharding. By what key?

Insight: At 1 record, everything works.
At 1B, partitioning strategy dominates.
Current problem (1M) needs indexes on query predicates.
Start with EXPLAIN ANALYZE on slowest queries.
```

### When to Use

- Solution feels over-engineered
- Premature optimization suspected
- Can't find right abstraction level

---

## 3. Meta-Pattern Recognition

Identify what class of problem this actually is.

### Steps

1. **Name the Class**: Is this scheduling? Resource allocation? Search?
2. **Find Precedents**: What solved this class before?
3. **Apply Adjacent Solution**: Translate from related domain
4. **Adapt to Context**: Modify for your specific constraints

### Common Problem Classes

| Surface Problem | Underlying Class | Known Solutions |
|-----------------|-----------------|-----------------|
| Task assignment | Scheduling | Priority queues, constraint solvers |
| API rate limits | Resource allocation | Token buckets, circuit breakers |
| File search | Graph traversal | BFS/DFS, indexing |
| Caching invalidation | Consistency | TTL, event-driven, version tags |
| Config management | State machines | Immutable configs, feature flags |

### Example: Feature Rollout

```
Stuck: How to safely roll out feature to subset of users?

Meta-Pattern:
Surface: "Feature flag system"
Class: Resource allocation + sampling
Precedents: A/B testing, canary deployments, load balancing

Insight: This is the same problem Netflix solved with Zuul.
Use percentage-based routing with sticky sessions.
```

### When to Use

- "This shouldn't be this hard"
- Problem feels novel but familiar
- Reinventing the wheel suspected

---

## 4. Assumption Inversion

List all assumptions, then systematically invert each.

### Steps

1. **List Assumptions**: Write every "given" or "must"
2. **Invert Each**: What if the opposite were true?
3. **Explore Solutions**: What becomes possible?
4. **Test Validity**: Is the assumption actually required?

### Example: Real-Time Dashboard

```
Stuck: Dashboard must show real-time data but DB can't handle load

Assumptions:
1. "Data must be real-time" → What if 30-second delay acceptable?
2. "Dashboard queries database" → What if dashboard queries cache?
3. "All users see same data" → What if data is user-specific?
4. "Users need live updates" → What if users refresh manually?

Inversions tested:
- Assumption 1: Stakeholders accept 30s delay. VALID INVERSION.
- Assumption 2: Cache reduces DB load 100x. VALID INVERSION.

Insight: "Real-time" meant "current" not "live".
Cache with 30s TTL solves the problem.
```

### When to Use

- All options seem bad
- Trapped by requirements
- "We have to do X" but X is blocking

---

## 5. Constraint Removal

Temporarily remove the blocking constraint, solve freely, then work back.

### Steps

1. **Identify Constraint**: What specific thing is blocking?
2. **Remove It**: Pretend it doesn't exist
3. **Solve Freely**: What's the ideal solution without it?
4. **Work Within**: Find ways to approximate ideal within constraint

### Example: Schema Migration

```
Stuck: Can't change database schema, but current schema blocks feature

Constraint removed: "What if I could change the schema?"

Free solution:
- Add new table for feature data
- Migrate existing data
- Update queries

Work within constraint:
- Can't change schema... but CAN add new table
- Can't migrate... but CAN write dual-write code
- Can't update queries... but CAN add abstraction layer

Insight: "Can't change schema" meant "can't modify existing tables".
Adding new table + abstraction layer achieves same result.
```

### When to Use

- One specific thing blocking all paths
- Feeling "if only I could..."
- Constraint feels artificial

---

## 6. Fresh Perspective

Reset mental model through externalization or role-shift.

### Techniques

**Rubber Duck**: Explain the problem out loud to an inanimate object. The act of articulating often reveals gaps.

**Expert Channel**: "What would [specific expert] do?"
- Distributed systems problem → "What would Werner Vogels prioritize?"
- API design → "What would Stripe do?"
- Performance → "What would a database internals engineer check first?"

**Draw It**: Switch from code/text to visual representation.
- Sequence diagrams for flow issues
- Entity diagrams for data issues
- State machines for logic issues

**Teach It**: Write explanation for someone unfamiliar. What do you skip or gloss over?

### Example: API Design

```
Stuck: Can't decide between REST and GraphQL for new API

Fresh Perspective (Draw It):
Drew data flow diagram.
Noticed: 90% of calls need single entity, 10% need complex joins.

Expert Channel:
"What would Stripe do?" → REST with expand parameter for relations.

Insight: Was overthinking. REST with selective expansion
handles both cases simply.
```

### When to Use

- Can't see the forest for the trees
- Overthinking simple problems
- Lost in implementation details
