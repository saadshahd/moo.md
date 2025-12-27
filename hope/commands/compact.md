---
description: Compact learnings by merging duplicates, boosting confidence on repeated patterns, and pruning stale entries. LLM performs semantic analysis.
---

# /compact

Deduplicate and merge learnings files using semantic analysis.

## Process

### 1. Read All Learnings

```bash
cat ~/.claude/learnings/failures.jsonl 2>/dev/null
cat ~/.claude/learnings/discoveries.jsonl 2>/dev/null
cat ~/.claude/learnings/constraints.jsonl 2>/dev/null
```

If files are empty or missing, report "No learnings to compact" and exit.

### 2. Semantic Analysis (LLM)

For each category, analyze entries and identify:

**Duplicates to merge:**
- Same insight expressed differently
- Same root cause for different symptoms
- Overlapping `applies_to` tags with same discovery

**Merge strategy:**
- Keep most specific/detailed wording
- Boost confidence: +0.05 per merged entry (max 0.95)
- Combine `applies_to` arrays (union)
- Use most recent timestamp

**Entries to prune:**
- Outdated (superseded by newer, more accurate learning)
- Too specific to a one-time situation
- Temporary constraints that no longer apply
- Low confidence (< 0.5) with no reinforcement

**DO NOT use fixed rules like "90 days old = prune".**
**Assess each entry's current relevance semantically.**

### 3. Create Backup

Before writing changes:

```bash
BACKUP_DIR=~/.claude/learnings/backup-$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
cp ~/.claude/learnings/*.jsonl "$BACKUP_DIR/" 2>/dev/null
```

### 4. Write Compacted Files

For each category, write the compacted JSONL:

```bash
# Clear and rewrite (atomic operation)
cat > ~/.claude/learnings/discoveries.jsonl << 'JSONL'
{"ts":"...","context":"...","discovery":"...","confidence":0.X,"applies_to":["..."]}
...
JSONL
```

### 5. Report Changes with Rationale

Output a detailed report explaining decisions:

```markdown
## Compaction Report

Backup created: ~/.claude/learnings/backup-YYYYMMDD-HHMMSS/

### discoveries.jsonl: N → M entries

**Merged:**
- "insight A" + "insight B" → "merged insight" (confidence 0.80 → 0.85)
  - Reason: Same discovery about [topic], different wording

**Pruned:**
- "old specific insight"
  - Reason: Superseded by more general learning

**Kept:** X entries unchanged

### failures.jsonl: N → M entries

[Similar format]

### constraints.jsonl: N → M entries

[Similar format]

---
Total: X entries → Y entries (Z merged, W pruned)
```

## Rules

- **LLM judges all decisions** - No hardcoded thresholds
- **Always backup first** - Never lose data
- **Explain every change** - Transparency in reasoning
- **Conservative pruning** - When in doubt, keep
- **Quality over quantity** - Fewer precise learnings > many vague ones

## Limits

- Max 50 entries per category after compaction
- If over limit, prioritize by: confidence > recency > specificity
