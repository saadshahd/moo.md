# Workflow Review Protocol

A one-time deny delivered this protocol; the hook stays silent from now on. The protocol itself is NOT one-time — it applies to every Workflow invocation for the rest of the session. For the call just blocked: complete the review below, then re-invoke.

Before authoring any workflow script — this one and every later one — put a decision table in the conversation. Six rows:

| Row | Decide | Failure it prevents |
|-----|--------|---------------------|
| 1. Fan-out | width × model × rough token cost | uncapped opus runs: 10–62 min vs 1.6 min capped |
| 2. Verification depth | none / single-vote / adversarial panel | 1.4M tokens across a 3-run spiral for 1 kept finding |
| 3. Output caps | word-capped schemas on every agent | "fluff" complaints, unbounded synthesis |
| 4. Coverage & assumptions | exclusions, top-N truncation, "already known" sets — confirm with the user, never invent | invented exclusion lists silently narrowing scope |
| 5. Concurrency reality | effective parallelism (shared resources serialize), barrier/straggler risk, honest wall-time | an "8-agent" run that was 97% sequential; 40% of wall time idle on one straggler |
| 6. Narration | log() plan — completion counters on every parallel stage | 1 log per 21 min; silent runs get killed |

Threshold:

- **Small** (≤4 agents, single phase, cheap model): state all six rows as visible defaults in conversation. Ask nothing.
- **Substantial** (anything more): one AskUserQuestion covering the 2–3 genuinely contested rows, with previews showing the phase tree and rough cost. Raw JS is never the review artifact.

Record the outcome inside the meta literal (meta must stay a pure literal):

```js
export const meta = {
  name: '...', description: '...',
  decisions: {
    'fan-out': { chosen: '4 experts on sonnet', by: 'user', why: 'cost over coverage' },
    // one entry per contested or defaulted row
  },
}
```

`by` is `'user'` (asked this session), `'default'` (stated as visible default this session), or `'author'` (baked into a bundled/saved script when it was written). A script without `meta.decisions` is evidence the review was skipped. For a script that arrives with decisions baked (`by: 'author'`), state the rows briefly and proceed — do not re-ask.

Narration rules: every parallel stage logs a completion counter ("4/8 done; running: x, y"). Declare serialized stages as serial — never imply parallelism that shared state defeats.
