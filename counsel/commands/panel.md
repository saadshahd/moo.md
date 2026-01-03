---
description: Assemble multiple experts for debate and consensus. Use for design decisions, architecture reviews, or tradeoff discussions.
---

# /counsel:panel

Assemble an expert panel for debate and guidance.

## Usage

```
/counsel:panel "Should I use Zustand or Redux?"
/counsel:panel --experts="osmani,hickey" review this architecture
/counsel:panel for this PR
```

## Inputs

- `$1` — Question or topic (required)
- `--experts` — Comma-separated expert names (optional, auto-selects if omitted)

## Process

### Step 1: Select Panelists

**Pre-filter:** Load `~/.claude/counsel-blocklist.json` and remove blocked profiles before selection. If `--experts` flag includes a blocked profile, warn and exclude it.

Load history from `.claude/logs/counsel-reviews.jsonl` if exists. Select 2-3 experts with distinct perspectives — each panelist should ask a fundamentally different question. If `--experts` specified, use those (minus blocked); otherwise auto-select per [inference.md](../skills/counsel/references/inference.md). If ambiguous, ask 1-2 clarifying questions first.

### Step 2: Generate Review

For each panelist, generate a descriptor based on their relevance to this question (see [confidence.md](../skills/counsel/references/confidence.md#descriptor-generation)). Never use expert names in output.

```
## Panel Review: [Topic]

**Panelists:** [descriptor A] (X/10), [descriptor B] (Y/10), [descriptor C] (Z/10)

### Consensus
- [Point all panelists would likely agree on]
- [Another agreed point]

### Dissent
**[descriptor A]:** [Position] — (cf. documented work)
  ↳ **[descriptor B] responds:** [Counter-position]

**[descriptor C]:** [Different angle] — (cf. documented work)
  ↳ **[descriptor A] responds:** [Rebuttal]

### Related Past Reviews
[If any: "This connects to your [date] review of [topic]..."]

### Open Questions
- [What panel cannot resolve — requires your judgment]

---
*Defense round available. Reply to push back on any point.*
*Use /counsel:calibrate if any perspective doesn't sound right.*
```

### Step 3: Log + Offer Defense

Output log entry for `.claude/logs/counsel-reviews.jsonl` with: ts, topic, panelists, consensus, dissent, tags. Offer defense round — if user pushes back, present defense to panel and generate counter-responses.

## Panel Size

- **Minimum:** 2 experts
- **Maximum:** 4 experts
- **Optimal:** 3 experts (manageable debate, diverse views)

## Constraints

- Every panelist must have distinct perspective
- Cite prior work for every strong position
- Flag genuine tradeoffs that panel cannot resolve
- Never manufacture false consensus

## Escalation

When panel splits with no resolution: flag as "GENUINE TRADEOFF — requires your judgment" and summarize both positions with citations.
