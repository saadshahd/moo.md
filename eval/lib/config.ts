import type { EvalConfig } from "./types";

export const CONCURRENCY = {
  MAX_PARALLEL: 10,
  DEFAULT_TIMEOUT_MS: 60_000,
} as const;

export const DEFAULT_CONFIG: EvalConfig = {
  timeout: CONCURRENCY.DEFAULT_TIMEOUT_MS,
  skipLayerD: false,
};

export const DETECT_SKILL_PROMPT = (userMessage: string) => `
For this user message: '${userMessage}'
Which skill would you use? Return ONLY: {"skill": "name"} or {"skill": null}
`;

export const QUALITY_RUBRIC = `
Evaluate the Claude output against these criteria. Score each 0-2:

## 1. Intent Clarification (0-2)
Skills should ASK before acting. Did Claude:
- 0: Jumped to solution without clarifying
- 1: Asked some questions but missed key unknowns
- 2: Asked targeted questions to surface intent, constraints, success criteria

## 2. Confidence Communication (0-2)
Skills require explicit confidence. Did Claude:
- 0: Made claims without stating confidence
- 1: Vague hedging ("probably", "likely")
- 2: Explicit percentages with evidence basis

## 3. Process Adherence (0-2)
Skills define methodology. Did Claude:
- 0: Generic response, no skill methodology visible
- 1: Partial methodology (some elements missing)
- 2: Full methodology: checklists, tables, structured output

## 4. Value Over Ceremony (0-2)
Did the output provide actionable insight?
- 0: Template/boilerplate with no substance
- 1: Some useful content amid ceremony
- 2: Concrete, specific, actionable guidance

## Verdict
- PASS: Score >= 6/8 AND Intent Clarification >= 1
- PARTIAL: Score 4-5 OR Intent Clarification = 0
- FAIL: Score < 4

Respond with JSON: { "scores": { "intent": N, "confidence": N, "process": N, "value": N }, "verdict": "PASS|PARTIAL|FAIL", "reasoning": "..." }
`;
