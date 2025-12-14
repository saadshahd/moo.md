# Research: Farnam Street → moo.md Plugin Learnings

**Date:** 2025-12-13
**Source:** 13 Farnam Street blog articles

---

## Executive Summary

Analyzed 13 FS blog articles for applicability to moo.md marketplace plugins. Found strong alignment with existing tools and identified 4 high-value gaps for potential new tools.

**Key Insight:** moo.md already embodies many FS principles (first principles, circle of competence, bayesian thinking). The biggest gaps are in **argumentation quality** and **deliberate practice frameworks**.

---

## Article-by-Article Analysis

### 1. Ayn Rand: Why Philosophy Matters
**Core Thesis:** Everyone needs philosophy to develop values and think critically. Choice isn't whether to have philosophy, but whether it's examined or chaotic.

**Key Concepts:**
- First principles: Ask "Why?" and "How do I know this?"
- Active minds > open minds - engagement over passive listening
- Examine inner states - motivations, triggers, reasoning

**moo.md Alignment:**
- `first-principles.md` - Direct match
- `hope:soul` Silent Audit - Partially captures "examine assumptions"
- Gap: No explicit "active mind" vs "open mind" distinction

---

### 2. The Value of Grey Thinking
**Core Thesis:** Reality exists in shades of grey. Understanding requires placing phenomena on continuums, not in binary boxes.

**Key Concepts:**
- "The dose makes the poison" - quantitative over categorical
- Avoid ideological slippery-slope fallacy
- Truth lies somewhere in between extremes

**moo.md Alignment:**
- `bayesian-thinking.md` - Updates beliefs with evidence
- Gap: No explicit "grey thinking" framework forcing nuance
- Gap: No false dichotomy detection tool

**Potential Tool:** `grey-thinking.md`
- When to use: Binary framing detected, heated debate, policy decisions
- Framework: Continuum placement, dose-response analysis, both-sides steel man

---

### 3. Experts vs Imitators
**Core Thesis:** Distinguish genuine experts from frauds. Real experts admit limits, explain flexibly, discuss failures.

**Key Concepts:**
- "Specific knowledge is earned, not learned"
- Comfort with "I don't know"
- Popularizers ≠ experts (communication skill ≠ deep expertise)

**moo.md Alignment:**
- `circle-of-competence.md` - Direct match (know your limits)
- Confidence gates (<70%, 70-85%, ≥85%) - Captures "admit uncertainty"
- Gap: No tool for evaluating others' expertise

---

### 4. Why You Should Practice Failure
**Core Thesis:** Deliberately practice failing in controlled environments. Pre-practiced responses bypass conscious thought under stress.

**Key Concepts:**
- Pilots practice stalls/spins before real emergencies
- "Slow response from seldom having accomplished the acts" = failure
- Build optionality through practiced failure responses

**moo.md Alignment:**
- `pre-mortem.md` - Anticipates failure BEFORE starting
- Gap: No tool for practicing failure DURING development
- Gap: No "muscle memory" framework for crisis response

**Potential Tool:** `deliberate-practice.md`
- When to use: Skill development, crisis preparation, interview prep
- Framework: Controlled failure practice, progressive difficulty, chunking

---

### 5. Job Interviews Don't Work
**Core Thesis:** Unstructured interviews are ineffective. They prioritize bias over competency.

**Key Concepts:**
- Confirmation bias, attribution error, intuition failure
- Structured interviews > unstructured (identical questions, standardized scoring)
- Blind auditions increased female orchestra representation 5% → 30%
- Work samples beat interviews

**moo.md Alignment:**
- `career/skills/career/references/simulate.md` - Interview practice
- Gap: No "structured > unstructured" explicit framework
- Gap: No bias-removal assessment design tool

---

### 6. Bad Arguments and How to Avoid Them
**Core Thesis:** Argue against opponents' strongest positions. Debate requires intellectual honesty.

**Key Concepts:**
- **Straw Man:** Misrepresent opponent's position
- **Hollow Man:** Fabricate non-existent opponent position
- **Iron Man:** Make own stance unfalsifiable through vagueness
- **Steel Man:** Re-express opponent's position so clearly they say "I wish I'd thought of putting it that way"
- **Ideological Turing Test:** Argue opponent's position so well observers can't tell your real view

**moo.md Alignment:**
- `munger-biases.md` - Covers some cognitive traps
- `ladder-inference.md` - Checks assumptions
- **MAJOR GAP:** No argumentation quality tool
- **MAJOR GAP:** No steel man framework

**Potential Tool:** `steel-man.md` (HIGHEST PRIORITY)
- When to use: Before critiquing any position, during debates, writing rebuttals
- Framework:
  1. State opponent's position
  2. Re-express it more clearly than they did
  3. Identify strongest version of their argument
  4. Only then critique
  5. Ideological Turing Test: Can you argue their side convincingly?

---

### 7. Five Percent Better
**Core Thesis:** Meaningful improvement through consistent incremental progress. Small daily refinements compound into extraordinary results.

**Key Concepts:**
- 5% annual improvement = 2x in 15 years, 4x in 30 years
- Big changes fail because behavior change requires extended adjustment
- Backsliding doesn't negate progress - just resume
- Consistency > perfection

**moo.md Alignment:**
- Learnings system (`~/.claude/learnings/`) - Captures discoveries over time
- Gap: No explicit "compound gains" framework
- Gap: No "tiny improvements" vs "big leaps" distinction

---

### 8. The Bikeshed Effect
**Core Thesis:** Organizations waste time on trivia while rushing critical decisions. Simple topics invite unnecessary opinions.

**Key Concepts:**
- £10M power plant = minimal discussion
- £350 bike shed = moderate debate
- £21 coffee = longest argument
- "The simpler a topic, the more people have opinions"

**moo.md Alignment:**
- `SCOPE` framework - Right-size analysis before starting
- `eisenhower.md` - Urgent vs important
- Strong alignment - This principle IS the SCOPE framework

---

### 9. Find What You Truly Value
**Core Thesis:** Crises reveal true values. Stated values ≠ demonstrated values.

**Key Concepts:**
- "It's one thing to say you are stoic when coffee spills, another when community collapses"
- Crisis = opportunity for value reflection
- Intrinsically rewarding activities ground you during uncertainty

**moo.md Alignment:**
- Gap: No values clarification tool
- Gap: No "stated vs demonstrated values" framework
- Partial: `opportunity-cost.md` forces value tradeoffs

---

### 10. Open-Minded vs Closed-Minded People
**Core Thesis:** Success correlates with openness to being wrong. Seven key differences distinguish open from closed minds.

**Key Concepts:**
1. Challenge ideas vs defend positions
2. Questions vs statements
3. Understand others vs be understood
4. The "but" test ("I could be wrong... but")
5. Listen vs speak
6. Hold competing thoughts simultaneously
7. Intellectual humility

**moo.md Alignment:**
- `ladder-inference.md` - Checks assumptions
- `bayesian-thinking.md` - Update beliefs with evidence
- `munger-biases.md` - Overconfidence bias
- Gap: No explicit "open-mindedness checklist"

---

### 11. Habits vs Goals
**Core Thesis:** Habits are superior to goals. They operate automatically and compound over time.

**Key Concepts:**
- Goals have endpoints → reversion to previous behavior
- Habits become automatic after ~30 days
- 40% of waking hours are habitual
- "First we make our habits, then our habits make us"
- Keystone habits trigger cascades

**moo.md Alignment:**
- Workflows A/B/C - Systematic approaches
- Gap: No explicit "habits > goals" framework
- Gap: No keystone habit identification tool

**Potential Tool:** `systems-over-goals.md`
- When to use: Goal-setting, New Year resolutions, behavior change
- Framework:
  1. Convert goal to daily habit
  2. Make habit atomic (tiny, automatic)
  3. Identify keystone habits
  4. Design environment for defaults

---

### 12. The Science of Success (Deliberate Practice)
**Core Thesis:** Expert performance = opportunity + deliberate practice + motivation. Not innate talent.

**Key Concepts:**
- **Chunking:** Experts process through meaningful pattern groups
- **Deliberate Practice Requirements:**
  - Work at edge of competence
  - Deep concentration
  - Challenging material (not easy tasks)
  - Internal motivation
- 10,000 hours only works with QUALITY practice
- "20 years experience might be 1 year repeated 20 times"

**moo.md Alignment:**
- `career/skills/career/references/drill.md` - Practice exercises
- Gap: No "edge of competence" framework
- Gap: No chunking/pattern recognition tool
- Gap: No quality-of-practice assessment

**Potential Tool:** `deliberate-practice.md` (HIGH PRIORITY)
- When to use: Skill development, learning new domain, career growth
- Framework:
  1. Identify current edge of competence
  2. Design practice just beyond comfort
  3. Chunk knowledge into patterns
  4. Seek immediate feedback
  5. Repeat with increasing difficulty

---

### 13. Reading Strategies
**Core Thesis:** Reading effectiveness depends on intentional selection, appropriate depth, and permission to quit.

**Key Concepts:**
- Four reading levels: Entertaining, Informing, Understanding, Mastering
- Match intensity to content value
- "Read old books. Read the best ones twice."
- Permission to quit mediocre books
- Speed is irrelevant; comprehension matters

**moo.md Alignment:**
- Gap: No input quality filter
- Gap: No "reading level selection" framework
- Partial: SCOPE framework could extend to input selection

---

## Proposed New Tools

### 1. `steel-man.md` (HIGHEST PRIORITY)

**Provenance:** Daniel Dennett's "Intuition Pumps" + FS "Bad Arguments"

**When to Use:**
- Before critiquing any position
- During debates or disagreements
- Writing rebuttals or counterarguments
- Code review feedback
- Design critiques

**Framework:**
```
1. STATE: Write opponent's position in their words
2. STRENGTHEN: Re-express it better than they did
3. STEELMAN: Find the strongest version of their argument
4. VALIDATE: Ask "Would they say 'I wish I'd said it that way'?"
5. CRITIQUE: Only now identify weaknesses
6. TEST: Can you pass the Ideological Turing Test?
```

**Anti-Patterns:**
- Straw Man: Misrepresenting to easily defeat
- Hollow Man: Fabricating non-existent positions
- Iron Man: Making your position unfalsifiable

**Combinations:**
- Use with `ladder-inference.md` to check your assumptions about their position
- Use with `conflict-resolution.md` for productive disagreement
- Use with `bayesian-thinking.md` to update your own beliefs

---

### 2. `deliberate-practice.md` (HIGH PRIORITY)

**Provenance:** Anders Ericsson's research + FS "Science of Success" + "Practice Failure"

**When to Use:**
- Developing any skill
- Career growth planning
- Learning new domain
- Preparing for high-stakes situations
- Interview preparation

**Framework:**
```
1. MAP: Identify current competence level (1-10)
2. EDGE: Define the skill just beyond current ability
3. CHUNK: Break complex skills into learnable patterns
4. DESIGN: Create practice that stretches, not strains
5. FEEDBACK: Establish immediate feedback loops
6. ITERATE: Progressive difficulty, not repetition
```

**Key Insight:**
> "Expert practice involves considerable effort to do something you can't do well—or even at all."

**Quality Checklist:**
- [ ] Am I working at my edge, not comfort zone?
- [ ] Is this challenging, not easy?
- [ ] Do I have immediate feedback?
- [ ] Am I internally motivated?
- [ ] Am I chunking into patterns?

**Anti-Patterns:**
- Repeating what you can already do
- Practicing without feedback
- External motivation only
- 20 years = 1 year × 20

**Combinations:**
- Use with `career:drill` for structured exercises
- Use with `pre-mortem.md` to practice failure scenarios
- Use with `circle-of-competence.md` to identify edges

---

### 3. `grey-thinking.md` (MEDIUM PRIORITY)

**Provenance:** FS "The Value of Grey Thinking" + Paracelsus ("dose makes the poison")

**When to Use:**
- Binary framing detected
- Heated debates
- Policy decisions
- When you catch yourself saying "always" or "never"
- Evaluating tradeoffs

**Framework:**
```
1. DETECT: Is this being framed as binary? (good/bad, right/wrong)
2. CONTINUUM: Place on spectrum - where exactly does it fall?
3. DOSE: At what scale/intensity does it become problematic?
4. CONTEXT: What conditions change the evaluation?
5. STEELMAN BOTH: What's the strongest case for each pole?
6. TRUTH: "The truth lies somewhere in between"
```

**Triggers:**
- "X is always bad"
- "You either have Y or you don't"
- "This is black and white"
- "There's no middle ground"

**Anti-Patterns:**
- False dichotomies
- Slippery slope fallacy
- Slogans replacing thinking
- Categorical thinking when quantitative is needed

**Combinations:**
- Use with `steel-man.md` for both-sides analysis
- Use with `bayesian-thinking.md` for probability over certainty
- Use with `decision-matrix.md` for nuanced scoring

---

### 4. `systems-over-goals.md` (MEDIUM PRIORITY)

**Provenance:** James Clear's "Atomic Habits" + FS "Habits vs Goals"

**When to Use:**
- Setting New Year resolutions
- Behavior change
- Productivity improvement
- When goals keep failing
- Building sustainable practices

**Framework:**
```
1. GOAL → SYSTEM: Convert outcome goal to process system
   "Read 50 books" → "Read 25 pages daily"

2. ATOMIC: Make smallest possible version
   "Exercise daily" → "Put on running shoes daily"

3. KEYSTONE: Identify habit that triggers cascades
   Morning routine → productivity → energy → relationships

4. ENVIRONMENT: Design defaults, not discipline
   Remove friction for good habits, add friction for bad

5. IDENTITY: "I am someone who..." not "I want to..."
```

**Why Goals Fail:**
- Goals have endpoints → reversion
- Goals depend on factors outside control
- Goals require constant willpower
- Goals create false sense of accomplishment

**Why Systems Work:**
- Habits become automatic (~30 days)
- Habits compound (40% of waking hours)
- Systems run without willpower
- "First we make our habits, then our habits make us"

**Combinations:**
- Use with `hope:soul` workflows for systematic approaches
- Use with `impact-effort.md` to prioritize which habits
- Use with `feedback-loops.md` to design reinforcement

---

## Enhancement Opportunities for Existing Tools

### `bayesian-thinking.md`
**Add:** Explicit "grey thinking" section
- Continuums over categories
- "Dose makes the poison" principle
- False dichotomy detection

### `pre-mortem.md`
**Add:** "Practice Failure" section
- Not just anticipate, but simulate
- Muscle memory for crisis response
- Controlled failure practice

### `circle-of-competence.md`
**Add:** Evaluating others' expertise
- Questions to probe real vs fake expertise
- Popularizer vs expert distinction
- "Specific knowledge is earned" test

### `career:simulate.md`
**Add:** Structured interview design
- Identical questions, standardized scoring
- Bias removal techniques
- Work samples over unstructured interviews

---

## Implementation Notes

**File Location:** All new tools go in `hope/skills/soul/references/tools/`

**Pattern to Follow:** Each tool should have:
1. Frontmatter with provenance
2. "When to Use" section with triggers
3. Visual framework (ASCII diagram if helpful)
4. Step-by-step process
5. Anti-patterns section
6. "Combinations" section (which tools work together)
7. Examples

**SKILL.md Updates Required:**
- Add new tools to appropriate category in tools table
- Update "Default Tools" if any are high-enough priority

---

## Next Steps (When Ready to Implement)

1. **Phase 1:** Add `steel-man.md` (biggest gap, most novel)
2. **Phase 2:** Add `deliberate-practice.md` (career plugin alignment)
3. **Phase 3:** Add `grey-thinking.md` and `systems-over-goals.md`
4. **Phase 4:** Enhance existing tools with FS insights
5. **Phase 5:** Update SKILL.md tool tables
6. **Phase 6:** Update CHANGELOG.md
