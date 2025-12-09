# Write a PRD

You need product requirements that don't drift. Requirements that survive contact with engineering.

## The Keyword

```
/product:prd "describe your product idea"
```

Examples:
- "/product:prd 'user authentication for a SaaS app'"
- "/product:prd 'in-app notifications system'"
- "/product:prd 'analytics dashboard for e-commerce'"

## What Happens

The system interrogates your idea before documenting it. It challenges assumptions and cuts scope ruthlessly.

### Phase 1: Context Dump

Paste your messy notes. Goals, users, features, constraints — whatever you have.

### Phase 2: Interrogation

Targeted questions across six areas:

**Vision & Validation**
- What problem are we solving? How do you know it's worth solving?
- Have you validated with real users?
- What's the smallest thing that solves the core problem?

**Users & Use Cases**
- Who's the primary user? How well do you understand their pain?
- What's the single most critical use case?

**Features & Scope**
- List essential features. Now: can we ship without each one?
- If you could only keep TWO features, which?

**Technical Requirements**
- What constraints exist?
- Is anything over-engineering the MVP?

**Success Metrics**
- How will you measure success?
- What KPIs indicate we solved the problem?

**Risks & Assumptions**
- Top 3 risks?
- Where is scope creep hiding?

### Phase 3: Challenge

The system summarizes what it learned and highlights:
- Potential bloat in the MVP
- Unvalidated assumptions
- Features that could be cut

Then asks: "Defend why each remaining feature must be included."

### Phase 4: Generate

Only after you confirm, the PRD is generated:

```
## 1. Executive Summary
[One paragraph: what, why, for whom]

## 2. Problem Statement
[The validated problem]

## 3. MVP Features
| Feature | Justification | Priority |
|---------|--------------|----------|

## 4. Technical Requirements

## 5. Success Metrics
| Metric | Target | Measurement |

## 6. Timeline & Milestones
[Phases with deliverables — no time estimates]

## 7. Risks & Mitigations
| Risk | Impact | Mitigation |
```

## Example Session

```
You: /product:prd "notification system for our mobile app"

System: Let me understand your needs. First:

1. What user behavior should trigger notifications?
2. Push only, or also in-app and email?
3. What's the current state — building from scratch or replacing?
4. Do users need notification preferences/settings?

You: Only push for now. Order updates and promotions.
     Building from scratch. Yes, they need settings.

System: I'm seeing potential scope creep. You mentioned:
- Push notifications ✓
- Order updates ✓
- Promotions ✓
- User settings ✓

Question: For MVP, do you need promotions? Or can that wait
until order updates are proven to work?

You: Good point — order updates only for MVP.

System: [Generates focused PRD with just order updates]
```

## The Key Discipline

**Challenge every feature: "Can we ship without this?"**

The system defaults to cutting scope, not adding. If you can't defend a feature with user evidence, it gets cut.

## When to Use This

| Situation | Use |
|-----------|-----|
| Starting a new feature | **/product:prd** |
| Validating an existing PRD | /product:prd-eval |
| Too many features, unclear priority | **/product:prd** (to force cuts) |

## Related Commands

| Command | Purpose |
|---------|---------|
| `/product:prd-eval` | Score existing PRD on 5 dimensions |
| `/product:metrics` | Turn vague goals into SMART goals |

---

| Say this | Get this |
|----------|----------|
| "/product:prd 'idea'" | Interrogative requirements gathering |
| "I need all these features" | Scope challenge |
| "MVP only" | Ruthless feature cuts |

**Next:** [Analyze Competitors](analyze-competitors.md) — know what you're up against
