# Focus Capacity Workflow

Analyze focus capacity using the λ/Δ/θ model and calculate meeting costs.

## Two Modes

This workflow has two modes:

1. **Parameter Estimation:** Discover your personal λ, Δ, θ values
2. **Meeting Cost Analysis:** Calculate true cost of a specific meeting

## Mode 1: Parameter Estimation

### The Model (Can Duruk's Framework)

| Parameter      | Definition                                                                             | Typical Range |
| -------------- | -------------------------------------------------------------------------------------- | ------------- |
| **λ (lambda)** | Interruptions per hour (meetings, DMs, email checks, "got a sec?", self-interruptions) | 0.5 - 4       |
| **Δ (delta)**  | Minutes to fully resume deep work after interruption                                   | 5 - 25        |
| **θ (theta)**  | Minimum uninterrupted minutes needed for meaningful progress                           | 30 - 90       |

### Interview Questions

Use Ask tool to gather (5-7 questions):

1. **Interruption Sources:** What typically interrupts your focused work? (meetings, Slack, email, colleagues, self-initiated breaks)

2. **Interruption Frequency:** On a typical day, roughly how many times are you pulled out of focused work before completing what you intended?

3. **Recovery Time:** When interrupted during complex work, how long does it genuinely take to get back to the same level of focus? (Be honest—it's usually longer than we think)

4. **Minimum Block Size:** What's the shortest block of uninterrupted time in which you can make meaningful progress on your hardest work?

5. **Self-Interruption Patterns:** How often do you interrupt yourself (checking phone, email, Slack "just in case")?

6. **Calendar Reality:** Looking at a typical week, how many hours do you have in blocks of [their θ estimate] or longer?

7. **Peak Focus:** When and how long are your best focus periods?

### Output: Parameter Estimation

```
## Focus Capacity Analysis

### Your Estimated Parameters

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| λ (interruptions/hour) | X.X | [Based on reported frequency] |
| Δ (recovery minutes) | XX | [Based on complexity of work + reported recovery] |
| θ (minimum block) | XX | [Based on work type + reported needs] |

### Deep Work Capacity

**Theoretical maximum (8-hour day):**
- Available minutes: 480
- θ-sized blocks possible: X (if uninterrupted)

**Realistic estimate:**
- With λ interruptions/hour: ~X interruptions/day
- Each costs Δ minutes recovery: X minutes lost
- Net productive minutes: ~X
- θ-sized blocks realistically achievable: X

### Bottleneck Analysis

**Your limiting factor:** [λ, Δ, or θ]

[Explanation of why this parameter hurts most]

### Highest-Leverage Change (This Week)

**Recommendation:** [Specific, actionable change]

**Why:** [How this addresses the limiting factor]

**Expected impact:** [Quantified improvement]
```

## Mode 2: Meeting Cost Analysis

### Input Required

Use Ask tool to gather:

1. **Meeting name/type**
2. **Duration** (minutes)
3. **Number of attendees**
4. **When scheduled** (time of day, position in calendar)
5. **Purpose** (decision, update, brainstorm, etc.)

### Cost Calculation

```
## Meeting Cost Analysis: [Meeting Name]

### Direct Time Cost

Attendees × Duration = Total person-hours
[X] people × [Y] hours = [Z] person-hours

### Fragmentation Cost

For each attendee type, estimate focus blocks destroyed:

| Attendee Type | Focus Blocks Destroyed | Explanation |
|---------------|----------------------|-------------|
| IC needing deep work | X blocks | [Why] |
| Manager | X blocks | [Why] |
| etc. | | |

A 30-minute meeting in the middle of a morning can destroy two 60+ minute blocks.

**Total blocks destroyed:** X

### Context-Switch Tax

Estimated Δ × Attendees = Hidden hours
[X] minutes × [Y] people = [Z] person-minutes ([A] person-hours)

### Total Focus Cost

| Component | Cost |
|-----------|------|
| Direct time | X person-hours |
| Fragmentation | X blocks (~Y person-hours equivalent) |
| Context-switch | X person-hours |
| **Total** | **X person-hours equivalent** |

### Value Threshold

This meeting is worth it if it:
- **Generates:** [What value would justify this cost?]
- **OR prevents:** [What negative outcome would justify this cost?]

### Alternatives

Could this outcome be achieved with less focus destruction?

| Alternative | Cost | Trade-off |
|-------------|------|-----------|
| Async document | X minutes write + Y minutes read | [What's lost] |
| Shorter sync | X person-hours | [What's lost] |
| Smaller group | X person-hours | [What's lost] |
| Cancel entirely | 0 | [What's lost] |

### Recommendation

[Specific recommendation with reasoning]
```

## Rules

- Be honest about Δ—most people underestimate recovery time by 2-3x
- Focus blocks destroyed matter more than meeting duration
- θ varies by work type—coding vs writing vs managing
- Always calculate alternatives—meetings are often the lazy default
- "Just in case" attendance is almost never worth the cost
