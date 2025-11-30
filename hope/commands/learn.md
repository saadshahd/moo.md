---
description: Extract learnings from this session into ~/.claude/learnings/
---

# /learn

Extract session learnings into compound knowledge.

## Steps

1. **Ensure directory exists**
   ```bash
   mkdir -p ~/.claude/learnings
   ```

2. **Extract Failures** → `failures.jsonl`
   ```json
   {"ts":"ISO","context":"area","failure":"what","root_cause":"why","prevention":"how to avoid"}
   ```

3. **Extract Discoveries** → `discoveries.jsonl`
   ```json
   {"ts":"ISO","context":"area","discovery":"learning","confidence":[0.X,0.Y],"applies_to":["areas"]}
   ```

4. **Extract Constraints** → `constraints.jsonl`
   ```json
   {"ts":"ISO","context":"area","constraint":"boundary","source":"how found","permanent":bool}
   ```

5. **Update Predictions** → `predictions.jsonl`
   - Mark outcomes: "confirmed" / "refuted" / "partial"

6. **Audit Contradictions**
   - Do new learnings conflict with existing ones?
   - If yes: surface via Ask tool

7. **Report Summary**
   - Failures logged: N
   - Discoveries logged: N
   - Predictions verified: N
   - Contradictions found: N

---

## Focus Area (optional)

$ARGUMENTS
