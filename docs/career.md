# career — Power User Reference

Career development workflows for Claude Code.

---

| Say this                                    | Get this                                 |
| ------------------------------------------- | ---------------------------------------- |
| "assess my AI fluency"                      | Rubric-based scoring + 90-day roadmap    |
| "simulate an interview for X role"          | Scenario practice with scoring           |
| "build STAR stories from my experience"     | Evidence-tagged interview narratives     |
| "analyze weaknesses in my work"             | Pattern recognition + practice drills    |
| "help me navigate this political situation" | Stakeholder matrix + 72-hour action plan |
| "what's the true cost of this meeting?"     | Focus capacity analysis                  |

---

## Install

```bash
/plugin install career@moo.md
```

## When It Activates

Auto-triggers on:

- Interview preparation, behavioral questions
- Career/skill assessment, gap analysis
- Job posting analysis, company research
- STAR narrative building
- Stakeholder navigation, political situations
- Executive communication evaluation
- Professional development, practice drills
- Focus capacity, meeting ROI analysis

## Commands

| Command            | Purpose                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `/car:assess`      | AI fluency assessment. 5 competencies, rubric scoring, 90-day roadmap.         |
| `/car:simulate`    | Interview simulator. Messy scenarios, 5-dimension scoring, expert calibration. |
| `/car:star`        | STAR-C narratives. Transform bullets into evidence-tagged interview stories.   |
| `/car:gap`         | Weakness analysis. Pattern recognition across evaluations, targeted drills.    |
| `/car:drill`       | Practice drills. Messy situation → constrained exercise → evaluation.          |
| `/car:eval-comm`   | Communication eval. Score executive updates on 5 dimensions + BLUF rewrite.    |
| `/car:stakeholder` | Political navigator. Stakeholder matrix, 3 options, 72-hour action plan.       |
| `/car:reframe`     | Perspective shift. 3 radical viewpoints on career challenges.                  |
| `/car:focus`       | Focus capacity. λ/Δ/θ model OR meeting cost analysis.                          |
| `/car:osint`       | Job intel. OSINT from job postings with evidence table.                        |

## When to Use

| Situation                    | Command                          |
| ---------------------------- | -------------------------------- |
| Preparing for interviews     | `/car:simulate` then `/car:star` |
| Want honest skill assessment | `/car:assess`                    |
| Have feedback, need patterns | `/car:gap`                       |
| Stuck on a career challenge  | `/car:reframe`                   |
| Navigating office politics   | `/car:stakeholder`               |
| Writing for executives       | `/car:eval-comm`                 |
| Evaluating a job opportunity | `/car:osint`                     |
| Too many meetings            | `/car:focus`                     |

---

## AI Fluency Assessment

The `/car:assess` command evaluates across 5 weighted competencies:

| Competency              | Weight | What it measures              |
| ----------------------- | ------ | ----------------------------- |
| Prompt Mastery          | 40%    | Effective prompt construction |
| Technical Understanding | 15%    | AI systems knowledge          |
| Practical Application   | 20%    | Workflow integration          |
| Critical Evaluation     | 15%    | Validation practices          |
| Workflow Design         | 10%    | Documented processes          |

**Plus:** Learning velocity assessment (informs roadmap)

Includes 6-part interview: core skill tests, technical understanding, critical evaluation, practical application, velocity assessment, advanced techniques.

**Output:** Component scores (1-10), overall weighted score, 90-day improvement roadmap, immediate actions.

## Interview Simulator

The `/car:simulate` command creates messy, realistic scenarios with:

- Conflicting stakeholder requirements
- Incomplete or contradictory data
- Time pressure and trade-offs
- Ethical considerations
- Resource constraints

**Scoring (1-5 each):**

- Constraint Discovery — Did you surface hidden limitations?
- Systematic Thinking — Did you break down the problem?
- Risk Assessment — Did you identify failure modes?
- AI Tool Usage — Did you demonstrate judgment over AI?
- Communication Clarity — Did you structure your response?

**Output:** Scores with evidence, one strength, one improvement area, do-over variant, expert-level response for calibration.

## STAR-C Narratives

The `/car:star` command transforms experience bullets into interview stories:

| Component      | Focus                                       |
| -------------- | ------------------------------------------- |
| **S**ituation  | Start with hardest constraint, quantify     |
| **T**ask       | Success criteria, stakes, who to satisfy    |
| **A**ction     | Decision points (not activities), reasoning |
| **R**esult     | Metrics, baseline comparison, impact        |
| **C**onstraint | What you'd change, what you learned         |

**Evidence tagging:** Each sentence tagged as [FACT], [INFERENCE], [OPINION], or [TK-VERIFY].

**AI disclosure:** Where AI was used, how it was validated, what it got wrong.

## Weakness Analysis

The `/car:gap` command analyzes multiple evaluated artifacts:

1. **Pattern recognition** — Recurring low scores, repeated feedback themes
2. **Surface vs deep** — Formatting issues vs reasoning/judgment gaps
3. **Prioritization** — Impact × Frequency × Fixability × Leverage
4. **Root cause** — Skill gap, habit gap, feedback gap, or judgment gap
5. **Practice exercises** — Targeted drills for top weaknesses

Requires minimum 3 evaluated artifacts.

## Practice Drills

The `/car:drill` command transforms messy situations into focused exercises:

| Skill         | Indicators            | Artifact          |
| ------------- | --------------------- | ----------------- |
| Judgment      | Multiple valid paths  | Decision doc      |
| Orchestration | Many moving parts     | Spec / Brief      |
| Coordination  | Multiple stakeholders | RACI              |
| Taste         | Standards undefined   | Rubric            |
| Updating      | New information       | Pivot memo        |
| Synthesis     | Too much info         | Executive summary |
| Framing       | Problem unclear       | Problem statement |

**Output:** Constrained drill (15-30 min, word limit, required sections), evaluation against criteria, next drill suggestion.

## Executive Communication Eval

The `/car:eval-comm` command scores on 5 dimensions (1-5 each):

| Dimension       | 5 = Best                      | 1 = Worst                  |
| --------------- | ----------------------------- | -------------------------- |
| BLUF            | Key message in first sentence | Must read entire doc       |
| Ask Clarity     | Explicit, actionable ask      | Implied, reader must infer |
| Context Economy | Minimum context, no excess    | All context, no update     |
| Risk Surfacing  | Explicit with mitigations     | Known risks not mentioned  |
| Scannability    | 30-second skim works          | Wall of text               |

**Output:** Scores with quoted evidence, edit to raise each by 1 point, BLUF-optimized rewrite.

## Stakeholder Navigator

The `/car:stakeholder` command analyzes political situations:

1. **Situation distillation** — Core issue, tensions, urgency
2. **Landscape mapping** — Agreed facts, disagreements
3. **Stakeholder matrix** — Power, position, interests, levers, approach
4. **Strategic options** — 3 paths (Collaborative, Assertive, Strategic Delay)
5. **Recommendation** — 72-hour action plan, risk mitigation, exit strategy

Each option includes success probability (be honest, not optimistic).

## Perspective Shift

The `/car:reframe` command generates 3 perspectives (practical → radical):

| Component          | Format         |
| ------------------ | -------------- |
| Reframe title      | 5-10 words     |
| Core insight       | 1 sentence     |
| Vivid story        | 100-150 words  |
| Memorable metaphor | 1 sentence     |
| Action tagline     | Under 12 words |

**Implementation bridge** for most practical option: tomorrow's step, metric, obstacle handling.

Techniques: Inversion, Time Shift, Role Swap, Assumption Burial, Scale Shift, Constraint Removal.

## Focus Capacity

The `/car:focus` command has two modes:

**Mode 1: Parameter Estimation**
Discover your personal λ/Δ/θ values (Can Duruk's model):

- λ (lambda) — Interruptions per hour
- Δ (delta) — Minutes to resume deep work
- θ (theta) — Minimum block for meaningful progress

**Mode 2: Meeting Cost Analysis**
Calculate true cost of a specific meeting:

- Direct time (attendees × duration)
- Fragmentation cost (focus blocks destroyed)
- Context-switch tax (Δ × attendees)
- Value threshold (what justifies this cost?)
- Alternatives (async, shorter, smaller, cancel)

## Job Intel

The `/car:osint` command analyzes job postings:

**Signal extraction:**

- Growth cues — "First hire," "founding member," "new team"
- Stability cues — Renewals, compliance, backfills
- Red flags — >90 days open, reposted, contradictory requirements

**Output:**

- Executive summary
- Where they're investing
- Career opportunities (hot vs stale roles)
- Culture & work style signals
- Watch outs + questions to ask
- Evidence table with sources and confidence

---

→ Source: [`career/skills/career/SKILL.md`](../career/skills/career/SKILL.md)
