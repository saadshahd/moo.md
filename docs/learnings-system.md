# Learnings System

Your thinking compounds. Every session builds on past sessions.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        Session                              │
│                                                             │
│    Work happens → Insights emerge → Session ends            │
│                                                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   ~/.claude/learnings/                      │
│                                                             │
│    failures.jsonl     (bugs, wrong assumptions)             │
│    discoveries.jsonl  (patterns, techniques)                │
│    constraints.jsonl  (limits, blockers)                    │
│                                                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Next Session                            │
│                                                             │
│    Recall surfaces relevant learnings → Better decisions    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Three Types of Learnings

| File | What it stores | Example |
|------|---------------|---------|
| `failures.jsonl` | Bugs, errors, wrong assumptions | "Race condition in async handler caused timeout" |
| `discoveries.jsonl` | Patterns, techniques that worked | "Use env var flag to prevent hook recursion" |
| `constraints.jsonl` | Limits, blockers, requirements | "Private repos can't use /plugin marketplace add user/repo" |

Each entry includes:
- **timestamp** — When it was learned
- **context** — What area it applies to
- **confidence** — How certain (0.0 to 1.0)
- **applies_to** — Tags for matching to future work

## Keywords

| Say this | Get this |
|----------|----------|
| "recall what I learned about X" | Surface relevant past learnings |
| `/hope:recall hooks` | Recall learnings about hooks specifically |
| `/hope:learn` | Extract learnings from current session |
| `/hope:compact` | Merge duplicates, prune stale entries |

## Recall: Surface Past Learnings

Before starting work in a domain, recall what you've learned:

```
recall what I learned about authentication
```

Or use the command:

```
/hope:recall authentication
```

The system reads your learnings files and surfaces relevant entries:

```
### Relevant Failures
- **jwt-validation**: Token expiry not checked → Prevention: Always validate exp claim

### Relevant Discoveries
- **session-management** (confidence: 0.85): Use sliding window for session refresh
  - Applies to: authentication, user-sessions

### Active Constraints
- **oauth-provider**: Rate limit of 100 requests/min (permanent: yes)
```

## Learn: Extract From Sessions

Learnings are captured automatically when sessions end (background process).

To manually extract learnings from the current session:

```
/hope:learn
```

To extract from a saved transcript:

```
/hope:learn /path/to/transcript.jsonl
```

The system:
1. Analyzes the session for significant insights
2. Deduplicates against existing learnings
3. Appends new entries to the appropriate files

## Compact: Maintain Quality

Over time, learnings accumulate. Some become redundant or outdated.

```
/hope:compact
```

The system:
1. Creates a backup (never loses data)
2. Merges duplicate insights (boosts confidence)
3. Prunes outdated or superseded entries
4. Reports all changes with rationale

```
## Compaction Report

Backup created: ~/.claude/learnings/backup-20241209-143052/

### discoveries.jsonl: 23 → 18 entries

**Merged:**
- "use env var for recursion" + "HOPE_EXTRACTING=1 pattern" → combined entry
  - Reason: Same discovery, different wording
  - Confidence: 0.85 → 0.90

**Pruned:**
- "workaround for old bug"
  - Reason: Superseded by proper fix in v2.0
```

## The Silent Audit

Every response runs through a silent audit. One item on the checklist:

```
□ Learnings recalled? (past failures/discoveries for this domain?)
```

You don't see this. But the system checks: "Have I learned anything relevant to this task?"

## File Format

All files use JSONL (JSON Lines) format — one JSON object per line.

**failures.jsonl:**
```json
{"ts":"2024-12-09T14:00:00Z","context":"hooks","failure":"Infinite recursion when hook spawns Claude","root_cause":"No guard against re-triggering","prevention":"Use HOPE_EXTRACTING=1 env var"}
```

**discoveries.jsonl:**
```json
{"ts":"2024-12-09T14:00:00Z","context":"hooks","discovery":"Gate SessionEnd hooks by counting user messages (>=3) to skip trivial sessions","confidence":0.85,"applies_to":["hooks","learnings-extraction"]}
```

**constraints.jsonl:**
```json
{"ts":"2024-12-09T14:00:00Z","context":"claude-code","constraint":"Private repos cannot use /plugin marketplace add user/repo","source":"Testing during plugin development","permanent":true}
```

## Integration with Workflows

The learnings system integrates with hope's workflows:

**Before building (Workflow A):**
- Recall surfaces past failures in this domain
- You avoid repeating mistakes

**Before debugging (Workflow B):**
- Recall shows similar bugs and their root causes
- Faster diagnosis

**Before planning:**
- Recall surfaces constraints that might affect the plan
- More realistic scope

---

| Say this | Get this |
|----------|----------|
| "recall X" | Surface relevant learnings |
| `/hope:learn` | Extract from current session |
| `/hope:compact` | Deduplicate and prune |

Your thinking compounds. Every session makes the next one better.
