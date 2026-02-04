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

---

## Clarification Mode (Loop Integration)

When invoked with `clarify {dimension} for: {spec}` pattern:

### Process

1. **Parse dimension** — Identify which spec dimension (Outcome/Scope/Constraints/Success/Done)

2. **Select experts** — Use dimension mapping:
   - Outcome → vision experts (Jobs, Graham, Kay, Victor)
   - Scope → architecture experts (Fowler, Hickey, Feathers, Alexander)
   - Constraints → engineering experts (Pike, Osmani, Hightower, Gregg)
   - Success → quality experts (Norman, Majors, Zhuo, Beck)
   - Done → delivery experts (Cagan, Humble, Newman)

3. **Generate options** — Each expert proposes a concrete clarification
   - Specific and measurable
   - Include brief reasoning from expert's philosophy

4. **Format response:**
   ```
   ### Clarification Options: {Dimension}

   **[Expert A descriptor]** recommends:
   "[Specific, measurable clarification]"
   _Reasoning: [Why from their philosophy]_

   **[Expert B descriptor]** recommends:
   "[Alternative clarification]"
   _Reasoning: [Why from their philosophy]_

   **[Expert C descriptor]** recommends:
   "[Another angle]"
   _Reasoning: [Why from their philosophy]_
   ```

### Extended Aspect Mappings

For aspects beyond the 5 core dimensions:

| Aspect | Experts |
|--------|---------|
| **Design** | Norman, Zhuo, Frost, Alexander |
| **UI** | Abramov, Osmani, Perry, Wathan |
| **UX** | Norman, Zhuo, Victor, Case |
| **Innovation** | Jobs, Kay, Victor, Matuschak |

### Example

```
/counsel:panel clarify outcome for: make auth better
```

**Response:**
```
### Clarification Options: Outcome

**A user experience expert (8/10)** recommends:
"Users complete login in under 3 seconds with zero failed attempts"
_Reasoning: Outcome should be measurable from user's perspective_

**A pragmatic systems thinker (7/10)** recommends:
"Reduce auth code complexity by 50%, making it modifiable in one sitting"
_Reasoning: Simpler code = easier to iterate, which is the real unlock_

**A systems architect (8/10)** recommends:
"Auth becomes a composable module usable across all products"
_Reasoning: Building blocks over bespoke solutions_
```

---

## Stuck Mode (Loop Integration)

When invoked with `stuck on [task]: [error]` pattern (from loop:start):

### Process

1. **Parse stuck context** — Extract task description, error message, failed approach
2. **Select diagnostic experts** — Auto-select 2-3 experts based on domain (debugging, architecture, testing)
3. **Generate diagnosis** — Each expert diagnoses the issue from their perspective
4. **Build consensus** — Find agreed-upon approach or present options

### Output Format

```
## Stuck Analysis: [task]

**Error:** [error summary]
**Failed Approach:** [what was tried]

### Diagnosis

**[Expert A descriptor] (X/10):** [diagnosis from their philosophy]
**[Expert B descriptor] (Y/10):** [diagnosis from their philosophy]

### Recommendations

1. **[approach]** (confidence: X/10)
   - Expert A supports because: [reason]
   - Expert B adds: [reason]

2. **[alternative approach]** (confidence: Y/10)
   - Expert C suggests because: [reason]

### Consensus Recommendation

[Most agreed-upon approach with confidence level]

### If Still Stuck

[What to try if first recommendation fails]
```

### Example Invocation

```
/counsel:panel stuck on "Add ValidationError import to auth.ts": "Module not found: './errors'"
```

**Response:**
```
## Stuck Analysis: Add ValidationError import

**Error:** Module not found: './errors'
**Failed Approach:** Direct import from relative path

### Diagnosis

**A dependency expert (7/10):** The error indicates the module path is incorrect or the file doesn't exist. Check if errors.ts exists and the path is relative to auth.ts.

**A project structure expert (8/10):** This is likely a path resolution issue. Verify the errors file location and whether you need @/ alias or different relative path.

### Recommendations

1. **Check file existence** (confidence: 8/10)
   - Run: `ls -la src/errors.ts` or `find . -name "errors.ts"`
   - If missing, create it first

2. **Fix import path** (confidence: 7/10)
   - If errors.ts is in different directory, adjust path
   - Check tsconfig paths for aliases

### Consensus Recommendation

First verify the errors file exists, then adjust the import path based on actual location. (8/10 confidence)

### If Still Stuck

Check if ValidationError is exported from errors.ts. May need named export.
```

### Integration

Loop invokes counsel:panel when:
- Task fails verification (stuckCount >= 1)
- Same error occurs twice

Loop applies recommendation by:
1. Extracting consensus recommendation
2. Updating task approach based on diagnosis
3. Retrying with new approach
