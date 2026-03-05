# Expert Consultation

Simulate expert perspectives by reasoning from documented positions to the user's context. Interactive guidance with invisible attribution — productive disagreement over comfortable consensus.

## Requirements

### Requirement: Grounded expert reasoning
Consult SHALL ground every expert's reasoning in documented positions. Grounding is internal discipline — experts reason from their documented work to the user's context. User-facing output SHALL contain suggestions and tradeoffs only, never claims, citations, or source references.

#### Scenario: Internal grounding
- **WHEN** an expert perspective informs a suggestion
- **THEN** the reasoning derives from the expert's documented positions, not hallucinated opinions

#### Scenario: No visible attribution
- **WHEN** suggestions are presented to the user
- **THEN** no expert name, documented source, or coverage acknowledgment appears in any output

### Requirement: Four consultation modes
Consult SHALL support four modes: Single (1 expert, focused perspective with pushback and limits), Panel (2-4 experts, debate tensions and surface disagreements), Review (3-4 experts, breadth sweep for coverage and gaps), Unblock (2-3 experts, diagnostic root cause and reframe). Mode SHALL be inferred from user signal or context. Expert selection SHALL enforce domain diversity: max 2 experts from the same domain row.

#### Scenario: Mode selection
- **WHEN** user signals "panel", "debate", or presents a tradeoff
- **THEN** consult assembles 2-4 experts for structured debate and synthesis

#### Scenario: Inferred mode
- **WHEN** user does not explicitly name a mode
- **THEN** consult infers the appropriate mode from context signals

#### Scenario: Domain diversity
- **WHEN** experts are selected for any mode
- **THEN** no more than 2 experts come from the same domain row in the domain map

### Requirement: Productive disagreement
If selected experts all agree easily, the wrong experts were selected. Consult SHALL select for productive tension. Output SHALL present concerns as interactive options the user selects from, not as passive text sections. Each consultation SHALL land on one actionable recommendation through the user's selection.

#### Scenario: Agreement triggers reselection
- **WHEN** assembled experts converge without friction
- **THEN** selection is reconsidered for missing perspectives that would challenge the consensus

#### Scenario: Interactive synthesis
- **WHEN** debate concludes
- **THEN** concerns are presented as AskUserQuestion options the user selects from, each with a concrete suggestion as label

### Requirement: Blocklist exclusion
Blocked experts SHALL be excluded from selection. The blocklist at `~/.claude/counsel-blocklist.json` uses case-insensitive matching. Partial name matches apply (e.g., "pocock" blocks "matt pocock").

#### Scenario: Blocked expert
- **WHEN** an expert matching a blocklist entry would be selected
- **THEN** that expert is excluded from the consultation

### Requirement: Invisible expert attribution
Expert names, sources, and attribution SHALL NOT appear in any user-facing output — not in text, AskUserQuestion labels, descriptions, or detail panels. Phrasings like "Fowler says" or "according to Hickey" are prohibited. The user sees what to do and why it matters, never who said it.

#### Scenario: Name prohibition
- **WHEN** any consult output is rendered
- **THEN** zero expert names appear in the output

#### Scenario: Attribution prohibition
- **WHEN** any detail panel is rendered
- **THEN** no source citations, book titles, or "according to" phrasings appear

### Requirement: Interactive Minto presentation
Consult SHALL present findings via AskUserQuestion using Minto pyramid structure. Label = the suggestion (conclusion first). Description = why it matters (one visible line). Detail panel = structured plain text, max 10 lines, ~40 chars per line, ALL CAPS section headers, dashes for bullets. Detail panels SHALL contain only WHY IT MATTERS and TRADEOFF sections. Forbidden detail panel headers: POSITIONS, TENSION, CONCERN. Every AskUserQuestion SHALL include a "Go deeper" option.

#### Scenario: Minto structure
- **WHEN** an AskUserQuestion option is presented
- **THEN** the label states the suggestion and the description states why it matters

#### Scenario: Detail panel constraints
- **WHEN** a detail panel is rendered
- **THEN** it has max 10 lines, uses only WHY IT MATTERS and TRADEOFF sections, and contains no forbidden headers

#### Scenario: Go deeper option
- **WHEN** AskUserQuestion is presented
- **THEN** a "Go deeper" option is always included

### Requirement: Minimal text discipline
Before AskUserQuestion: exactly one bold sentence framing the core diagnosis or reframe. After user selection: exactly one bold sentence with the next step. No paragraphs, no per-expert reasoning, no multi-line explanations between interactive prompts.

#### Scenario: Pre-question text
- **WHEN** consult presents before AskUserQuestion
- **THEN** output is exactly one markdown bold sentence

#### Scenario: Post-selection text
- **WHEN** user selects an option
- **THEN** consult responds with exactly one markdown bold sentence before the next action

### Requirement: Four-step workflow cycle
Consult SHALL follow a four-step workflow: Route (infer mode, select experts, check blocklist — no output), Reason (experts argue internally, distill to anonymous suggestions — no output), Present (one bold sentence + AskUserQuestion), Land (one bold sentence + handle selection). Land SHALL support four continuations: Satisfied (done, no recap), Go deeper (return to Reason with narrower focus), Different perspective (swap expert, return to Reason), Challenge (counterargument via AskUserQuestion).

#### Scenario: Silent reasoning
- **WHEN** Step 2 (Reason) executes
- **THEN** no text output is produced; reasoning is internal only

#### Scenario: Workflow loop
- **WHEN** user selects "Go deeper" or "Different perspective" in Step 4 (Land)
- **THEN** workflow returns to Step 2 (Reason) with adjusted focus or experts

#### Scenario: Clean termination
- **WHEN** user selects "Satisfied"
- **THEN** consultation ends with no recap or summary
