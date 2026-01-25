---
description: Extract learnings from this session into ~/.claude/learnings/
---

# /learn

Extract session learnings into compound knowledge.

## Input

$0

If a transcript path is provided above, read it using the Read tool. Otherwise, analyze the current session context.

## Extraction Process

1. **Read source**:
   - If no path provided, analyze current session context
   - If path provided, first check file size:
     ```bash
     wc -l < "$PATH"
     ```
   - **Large files (> 500 lines)**: Read in chunks using Read tool with offset/limit:
     - Calculate: `offset = line_count - 300`
     - Read last 300 lines: `Read(path, offset: X, limit: 300)`
     - Focus on user messages and assistant responses
     - Skip verbose tool output unless it contains errors
   - **Small files (<= 500 lines)**: Read entire file with Read tool

2. **Ensure directory exists**:
   ```bash
   mkdir -p ~/.claude/learnings
   ```

3. **Read existing learnings for deduplication**:
   ```bash
   cat ~/.claude/learnings/failures.jsonl 2>/dev/null
   cat ~/.claude/learnings/discoveries.jsonl 2>/dev/null
   cat ~/.claude/learnings/constraints.jsonl 2>/dev/null
   ```

4. **Deduplication rules** (apply before writing each learning):
   - **Exact match**: Skip if (context + key field) matches existing entry
     - Failures: context + failure + root_cause
     - Discoveries: context + discovery
     - Constraints: context + constraint
   - **Semantic match**: Skip if existing entry covers same insight, even if worded differently
   - **When in doubt, skip**: Fewer quality entries > many duplicates

5. **Extract and write each category** (use current timestamp in ISO format):

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

6. **Be selective**: Only significant learnings. Skip routine actions.

7. **Use empty arrays** if no items in a category.

8. **Report summary**:
   - Failures: N new (M duplicates skipped)
   - Discoveries: N new (M duplicates skipped)
   - Constraints: N new (M duplicates skipped)
