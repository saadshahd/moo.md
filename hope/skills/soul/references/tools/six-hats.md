# Six Thinking Hats

Explore decisions from multiple perspectives systematically.

## When to Use

| Trigger                             | Use This Tool                   |
| ----------------------------------- | ------------------------------- |
| Group stuck in one mode of thinking | Force perspective shifts        |
| Emotional debate blocking progress  | Separate emotion from logic     |
| Need comprehensive analysis         | Cover all angles systematically |

## The Framework

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🔵 BLUE (Process)      🟢 GREEN (Creative)                │
│   "What's our process?"   "What alternatives exist?"        │
│                                                             │
│   ⬜ WHITE (Facts)        🟡 YELLOW (Benefits)              │
│   "What do we know?"      "What's the upside?"              │
│                                                             │
│   🔴 RED (Emotion)        ⬛ BLACK (Risks)                  │
│   "How do we feel?"       "What could go wrong?"            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Hat Details

| Hat        | Focus                    | Key Questions                                       |
| ---------- | ------------------------ | --------------------------------------------------- |
| **Blue**   | Process, agenda          | What are we trying to decide? What's next?          |
| **White**  | Facts, data              | What do we know? What data do we need?              |
| **Red**    | Feelings, intuition      | What's your gut reaction? (no justification needed) |
| **Yellow** | Benefits, value          | What are the advantages? Why might this work?       |
| **Black**  | Risks, caution           | What could go wrong? What are the weaknesses?       |
| **Green**  | Creativity, alternatives | What else could we do? Any wild ideas?              |

## How to Apply

**Parallel thinking:** Everyone wears same hat at same time.

1. **Blue hat:** Frame the question (2 min)
2. **White hat:** Share facts only (5 min)
3. **Red hat:** Quick gut reactions (2 min)
4. **Yellow hat:** List benefits (5 min)
5. **Black hat:** List risks (5 min)
6. **Green hat:** Generate alternatives (5 min)
7. **Blue hat:** Summarize and decide (3 min)

## Rules

| Rule                       | Rationale                |
| -------------------------- | ------------------------ |
| One hat at a time          | Prevents mode mixing     |
| Everyone wears same hat    | No devil's advocates     |
| Red hat = no justification | Pure intuition check     |
| Black hat isn't negative   | It's risk identification |
| Time-box each hat          | Prevents getting stuck   |

## Example

**Decision:** Should we rebuild the authentication system?

```
🔵 BLUE: We're deciding whether to rebuild auth or patch it.

⬜ WHITE:
- 3 security incidents in 6 months
- Current system is 5 years old
- Rebuild estimate: 6 weeks
- Patch estimate: 2 weeks

🔴 RED:
- "I dread touching auth code"
- "Excited about modern approach"
- "Nervous about 6-week timeline"

🟡 YELLOW:
- Modern patterns reduce future incidents
- Team learns current best practices
- Better observability built-in

⬛ BLACK:
- 6 weeks without new features
- Migration risk for existing users
- Team lacks recent auth experience

🟢 GREEN:
- Hybrid: rebuild core, migrate incrementally
- Buy vs. build (Auth0, Clerk)
- Hire contractor with auth expertise

🔵 BLUE: Decision = evaluate Auth0 this week, decide by Friday.
```
