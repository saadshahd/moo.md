# When NOT to Use Breakthrough Techniques

Breakthrough techniques are for genuine creative blocks, not general productivity.

## Do Not Use When

### 1. Problem Is Well-Defined

**Sign**: You know exactly what to do, just haven't done it.

```
Bad: "I'm stuck on implementing the login form"
     (You have the design, you have the API, you just need to code it)

Good use: "I'm stuck on how to handle auth across microservices"
          (Genuine architectural uncertainty)
```

**Action**: Execute. The "stuckness" is resistance, not confusion.

### 2. Haven't Done Basic Research

**Sign**: You're guessing instead of searching.

```
Bad: "I'm stuck on date formatting in JavaScript"
     (Have you searched MDN? Stack Overflow?)

Good use: "I've read three articles on timezone handling
          and they contradict each other"
          (Research done, still unclear)
```

**Action**: Research first. THEN apply breakthrough if still stuck after learning the domain.

### 3. Constraint Is Actually Non-Negotiable

**Sign**: The constraint exists for legal, security, or physics reasons.

```
Bad: Using Assumption Inversion on "must encrypt PII"
     (Compliance requirement, not optional)

Bad: Using Constraint Removal on "can't exceed speed of light"
     (Physics is not negotiable)

Good use: Using Assumption Inversion on "must use SQL"
          (May be organizational habit, not hard requirement)
```

**Action**: Distinguish true constraints (laws, physics, security) from inherited assumptions (past decisions, organizational inertia).

### 4. You're Procrastinating on Hard Work

**Sign**: Applying technique after technique without implementing anything.

```
Bad: Spending an hour on "meta-pattern recognition" to avoid
     writing the tedious migration script.

Good use: Spending 15 minutes on breakthrough, finding a path,
          then immediately executing.
```

**Action**: Set a time box (15-30 min). If no breakthrough, the path forward is through the hard work, not around it.

### 5. "Stuck" Is Actually Fear of Commitment

**Sign**: You have viable options but won't pick one.

```
Bad: "I'm stuck choosing between React and Vue"
     (Both work. Analysis paralysis, not creative block.)

Good use: "I'm stuck because all framework options
          have deal-breaking tradeoffs for our constraints"
          (Genuine dilemma, not preference paralysis)
```

**Action**: Make a reversible decision and learn. Type 2 decisions don't need perfect analysis.

## Self-Check Before Using

Ask yourself:

1. **Do I know what to do but don't want to?** → Execute, don't "breakthrough"
2. **Have I spent 30+ minutes researching?** → Research first
3. **Is the constraint truly immovable?** → Work within it
4. **Am I avoiding hard work?** → Time-box, then work
5. **Am I afraid to commit?** → Make reversible decision

## Signs You Actually Need Breakthrough

- Tried multiple approaches, all genuinely failed
- Can articulate specifically what's blocking
- Research revealed complexity, not clarity
- Constraint feels wrong but you've challenged it
- Deadline pressure isn't the blocker

## The Real Test

> "If someone solved this for me right now, would I immediately understand why it works?"

- **Yes** → You don't need breakthrough. You need to think harder or research more.
- **No** → Breakthrough techniques may reveal the hidden structure.
