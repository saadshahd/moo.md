---
description: Extract learnings from this session into ~/.claude/learnings/
---

# /learn

Extract session learnings into compound knowledge.

## Input

$ARGUMENTS

If a transcript path is provided above, read it using the Read tool. Otherwise, analyze the current session context.

## Extraction Process

1. **Read source**: If path provided, use Read tool on that file. Otherwise use current session.

2. **Ensure directory exists**:
   ```bash
   mkdir -p ~/.claude/learnings
   ```

3. **Extract and write each category** (use current timestamp in ISO format):

### Failures → `~/.claude/learnings/failures.jsonl`
Bugs, errors, wrong assumptions, things that didn't work.
```json
{"ts":"ISO","context":"area","failure":"what","root_cause":"why","prevention":"how"}
```

### Discoveries → `~/.claude/learnings/discoveries.jsonl`
Insights, patterns, techniques that worked well.
```json
{"ts":"ISO","context":"area","discovery":"insight","confidence":0.X,"applies_to":["areas"]}
```

### Constraints → `~/.claude/learnings/constraints.jsonl`
Limits, blockers, requirements discovered.
```json
{"ts":"ISO","context":"area","constraint":"limit","source":"how found","permanent":bool}
```

4. **Be selective**: Only significant learnings. Skip routine actions.

5. **Use empty arrays** if no items in a category.

6. **Report summary**:
   - Failures logged: N
   - Discoveries logged: N
   - Constraints logged: N
