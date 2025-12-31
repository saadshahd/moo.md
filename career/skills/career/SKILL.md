---
name: career
description: Use when preparing for interviews, assessing skills, analyzing job opportunities, navigating stakeholder politics, or developing professional capabilities. Auto-activates on interview prep, career assessment, job search, skill gaps, feedback interpretation, leadership development, or professional growth tasks.
---

# Career Skill

Router skill for career development workflows. Detects task type and routes to appropriate workflow.

## When This Skill Activates

You're working on:

- Interview preparation or simulation
- Career/skill assessment and gap analysis
- Job posting analysis or opportunity evaluation
- STAR narrative building for behavioral interviews
- Stakeholder navigation and political situations
- Executive communication evaluation
- Professional skill development and practice drills
- Focus capacity and meeting ROI analysis
- Perspective shifting on career challenges

## Workflow Selection

Announce which workflow you're using:

| Task Type                                  | Workflow              | Reference                   |
| ------------------------------------------ | --------------------- | --------------------------- |
| AI fluency evaluation, skill assessment    | AI Fluency Assessment | `references/assess.md`      |
| Interview practice, scenario simulation    | Interview Simulator   | `references/simulate.md`    |
| Behavioral stories, achievement narratives | STAR-C Narrative      | `references/star.md`        |
| Weakness patterns, skill gap analysis      | Gap Analysis          | `references/gap.md`         |
| Practice drills, situation-to-skill        | Practice Drill        | `references/drill.md`       |
| Executive updates, leadership emails       | Communication Eval    | `references/eval-comm.md`   |
| Political situations, stakeholder dynamics | Stakeholder Navigator | `references/stakeholder.md` |
| Mental ruts, alternative viewpoints        | Perspective Shift     | `references/reframe.md`     |
| Meeting costs, deep work capacity          | Focus Capacity        | `references/focus.md`       |
| Job posting OSINT, company intelligence    | Job Intel             | `references/osint.md`       |

## Related Thinking Tools

From `hope/skills/soul/references/tools/`:

| Tool                                                                                  | When to Use                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------- |
| [SBI](../../hope/skills/soul/references/tools/sbi.md)                                 | Give or receive feedback without judgment |
| [Conflict Resolution](../../hope/skills/soul/references/tools/conflict-resolution.md) | Navigate stakeholder disagreements        |
| [Ladder of Inference](../../hope/skills/soul/references/tools/ladder-inference.md)    | Check assumptions in political situations |
| [Circle of Competence](../../hope/skills/soul/references/tools/circle-of-competence.md) | Know your strengths and limits           |

From this skill's `references/`:

| Tool                                      | When to Use                             |
| ----------------------------------------- | --------------------------------------- |
| [10/10/10 Rule](../../hope/skills/soul/references/tools/10-10-10.md) | Daily career decisions with time clarity |
| [Feynman Technique](references/feynman-technique.md) | Deep learning, interview prep, verify understanding |

## Usage

1. Detect which workflow applies based on user's task
2. Announce: "I'm using the career skill for [workflow]"
3. Load the appropriate reference file
4. Execute the workflow exactly as written

## Rules

- Use Ask tool to gather input before proceeding
- Be direct and honest—career growth requires uncomfortable feedback
- Focus on actionable improvements, not encouragement
- Ground recommendations in evidence from user responses
- Use story points for effort estimates, never time

## Quality Footer (Required for Assessments)

All assessment, simulation, and stakeholder navigation outputs MUST end with:

```
---
| Confidence | X-Y% |
| Key Assumption | [What would change this assessment] |
| Reversibility | Type 2A/2B/1 |
```

**Evidence requirements:**
- Assessments must cite specific user responses
- Simulations must ground feedback in observable patterns
- Stakeholder analysis must distinguish [FACT] from [INFERENCE]
