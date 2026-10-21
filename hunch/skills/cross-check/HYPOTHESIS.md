With `cross-check`, agents that answered one question differently critique each other's answers, and Claude rules on the evidence they raise. The bet: the authors hold more context than the lead, so their critique finds facts the lead would miss alone.

Before building on it, count past sessions where two or more rival answers to one question reached the user and stayed unresolved. Under 3 in the transcripts on hand → drop it here.

Graduate when, in the first 2 weeks of real sessions, 3 rulings change the pick the lead wrote down before the critique, and the user keeps the changed pick. Kill if none do. Under ~3 runs in those 2 weeks is a firing or base-rate problem, not an answer.

## Field notes

### 2026-10-21 — founding, from warpdotdev's `cross-critique` skill

- Kept: a blind first round; each author sees rivals, never its own; credit then attack; revise own pick; weigh by evidence, never votes.
- Changed: Warp counts agreement after critique as a strong signal. Here an author's switch counts only through the fact that moved it, so a confident voice can't win by persuasion.
- Changed: Warp's "why it wins" lines read as fluff to the user. Each ruling line ties one option to a fact and to who raised it.
- Added: the lead's own pick, written before the critique. It shows the user what the critique changed, and it is this hunch's measure.
- Cost: N authors × 2 rounds. Agents launched together each pay a cold cache; start one, wait for its first reply, then the rest.
