# Expert Consultation

Simulate expert perspectives by reasoning from documented positions to the user's context. Productive disagreement over comfortable consensus.

## Requirements

### Requirement: Grounded expert reasoning
Consult SHALL ground every claim in documented work, naming the source and where coverage stops. Experts reason from their documented positions — they do not hallucinate opinions.

#### Scenario: Source attribution
- **WHEN** an expert perspective is presented
- **THEN** it names the documented source and acknowledges where the expert's coverage ends

### Requirement: Four consultation modes
Consult SHALL support four modes based on signal: Single (named expert or keyword match — one perspective), Panel (2-4 experts argue then synthesize), Review (3-4 experts for breadth), Unblock (2-3 diagnostic experts for stuck situations).

#### Scenario: Mode selection
- **WHEN** user signals "panel", "debate", or presents a tradeoff
- **THEN** consult assembles 2-4 experts for structured debate and synthesis

### Requirement: Productive disagreement
If selected experts all agree easily, the wrong experts were selected. Consult SHALL select for productive tension. Output SHALL be organized by concern, not by expert, landing on one actionable recommendation.

#### Scenario: Agreement triggers reselection
- **WHEN** assembled experts converge without friction
- **THEN** selection is reconsidered for missing perspectives that would challenge the consensus

#### Scenario: Actionable synthesis
- **WHEN** debate concludes
- **THEN** output is organized by concern with one concrete next step the user can act on

### Requirement: Blocklist exclusion
Blocked experts SHALL be excluded from selection. The blocklist at `~/.claude/counsel-blocklist.json` uses case-insensitive matching. Partial name matches apply (e.g., "pocock" blocks "matt pocock").

#### Scenario: Blocked expert
- **WHEN** an expert matching a blocklist entry would be selected
- **THEN** that expert is excluded from the consultation
