# Validate Idea

Rigorously validate a product idea for problem/market fit before spending another hour or dollar.

## Input Required

Ask for (if not provided):

- Product idea or value proposition (one sentence)
- Target persona (role + industry)
- Evidence collected so far (links, anecdotes, metrics, or "none")

## Phase 1: DFV Quick Score

Score the idea on three core dimensions (0-10 each):

| Dimension        | Question                             | Score |
| ---------------- | ------------------------------------ | ----- |
| **Desirability** | Do users actually want this?         | 0-10  |
| **Feasibility**  | Can we build this with current tech? | 0-10  |
| **Viability**    | Can we make money from this?         | 0-10  |

## Phase 2: Stress Test (5 Axes)

Deep-dive scoring with weighted importance:

| Axis                                                  | Weight | Score (0-10) | One-Sentence Justification |
| ----------------------------------------------------- | ------ | ------------ | -------------------------- |
| **Pain Intensity** (cost of inaction)                 | 30%    |              |                            |
| **Budget Reality** (proof of spend)                   | 25%    |              |                            |
| **Pain Frequency** (daily/weekly/monthly)             | 20%    |              |                            |
| **AI Feasibility** (can today's models deliver?)      | 15%    |              |                            |
| **Switching Friction** (ease of replacing status quo) | 10%    |              |                            |

**Weighted Total:** Calculate: (Intensity × 0.30) + (Budget × 0.25) + (Frequency × 0.20) + (Feasibility × 0.15) + (Friction × 0.10) = X/10 → X × 10 = Score/100

## Phase 3: Verdict

| Score | Verdict     | Action                        |
| ----- | ----------- | ----------------------------- |
| ≥75   | **GO**      | Proceed to build/fundraise    |
| 50-74 | **ITERATE** | Research gaps, pivot elements |
| <50   | **KILL**    | Abandon or major pivot        |

## Output Format

```json
{
  "dfv": {
    "desirable": 0-10,
    "feasible": 0-10,
    "viable": 0-10
  },
  "stress_test": {
    "pain_intensity": { "score": 0-10, "justification": "" },
    "budget_reality": { "score": 0-10, "justification": "" },
    "pain_frequency": { "score": 0-10, "justification": "" },
    "ai_feasibility": { "score": 0-10, "justification": "" },
    "switching_friction": { "score": 0-10, "justification": "" }
  },
  "weighted_total": 0-100,
  "verdict": "GO|ITERATE|KILL",
  "killer_assumption": "<single biggest risk - max 15 words>",
  "quick_falsification_test": "<48h experiment to validate/invalidate>",
  "next_research_actions": ["<action 1>", "<action 2>"]
}
```

Also provide:

- 75-word rationale for the verdict
- If ITERATE/KILL: two research actions to raise score fastest

## Rules

- Be brutally honest—most ideas fail
- Cite evidence or explicitly note "no evidence"
- Killer assumption must be ≤15 words
- Falsification test must be doable in 48 hours
- Use Ask tool to gather missing context before scoring
