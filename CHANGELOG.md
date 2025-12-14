# Changelog

All notable changes to moo.md are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.4.3] - 2025-12-14

### Added
- **6 thinking tools** (Farnam Street research):
  - `incentives.md` - Munger's "show me the incentive" for predicting/explaining behavior
  - `bottlenecks.md` - Goldratt's Theory of Constraints for finding binding limits
  - `steel-man.md` - Argue against strongest version of opposing positions (Dennett/Rapoport)
  - `deliberate-practice.md` - Expert skill development at edge of competence (Ericsson)
  - `grey-thinking.md` - Avoid binary thinking, dose makes the poison (Paracelsus)
  - `systems-over-goals.md` - Habits compound, goals have endpoints (Clear/Adams)

### Changed
- hope plugin version 0.4.2 → 0.4.3
- Thinking tools count 28 → 34
- Systems category now includes Incentives and Bottlenecks
- Decision category now includes Grey Thinking
- Prioritization category now includes Systems Over Goals
- Communication category now includes Steel Man
- Creative category now includes Deliberate Practice
- PHILOSOPHY.md: Added "Foundation" section (decision-making as learnable skill)
- `pre-mortem.md`: Added "Practice Failure" section - simulate, don't just anticipate
- `circle-of-competence.md`: Added "Evaluating Others' Expertise" section
- `bayesian-thinking.md`: Added "Grey Thinking Integration" section

---

## [0.4.2] - 2025-12-13

### Removed
- **7 redundant thinking tools** (bloat reduction per Anthropic guidelines):
  - `hanlons-razor.md` - Too niche (5% use cases)
  - `occams-razor.md` - First Principles is more actionable
  - `mece.md` - Principle is embedded in Issue Trees
  - `pareto.md` - Covered by Impact-Effort matrix
  - `sunk-cost.md` - Single-concept, merged note into Opportunity Cost
  - `lindy-effect.md` - Bayesian heuristic, not standalone tool
  - `six-hats.md` - 70% overlap with Productive Thinking

### Added
- **Default Tools section** in hope SKILL.md - 6 go-to tools for common situations
  - Follows Anthropic's "default with escape hatch" pattern
  - Reduces decision paralysis from 27+ tool options

### Changed
- hope plugin version 0.4.1 → 0.4.2
- Thinking tools count 35 → 28
- Tools table now has "Default Tools" + "All Tools" structure

---

## [0.4.1] - 2025-12-13

### Added
- **Munger's 25 Cognitive Biases** checklist in `hope/skills/soul/references/tools/munger-biases.md`
  - Pre-decision bias check for high-stakes decisions
  - Quick checklist for scanning common misjudgments
  - Lollapalooza effect warning (multiple biases combining)

### Changed
- hope plugin version 0.4.0 → 0.4.1
- Thinking tools count 34 → 35

---

## [0.4.0] - 2025-12-13

### Added
- **5 Strategic Frameworks** (meta-level thinking frameworks):
  - `hope/skills/soul/references/handshake.md` - Align/Build/Commit for driving action
  - `hope/skills/soul/references/scope.md` - SCOPE pre-analysis right-sizing
  - `hope/skills/soul/references/leverage-points.md` - Donella Meadows' 12 intervention points
  - `hope/skills/soul/references/spot.md` - SPOT pattern recognition → action
  - `wordsmith/skills/writing/references/open-loop.md` - Zeigarnik retention framework
- **4 new thinking tools**:
  - `hope/skills/soul/references/tools/bayesian-thinking.md`
  - `hope/skills/soul/references/tools/lindy-effect.md`
  - `hope/skills/soul/references/tools/map-territory.md`
  - `hope/skills/soul/references/tools/opportunity-cost.md`
- **2 product references**:
  - `product/skills/product/references/jobs-to-be-done.md`
  - `product/skills/product/references/systems-archetypes.md`
- **1 career reference**:
  - `career/skills/career/references/10-10-10.md`
- Strategic Frameworks section in hope SKILL.md
- Open Loop reference in wordsmith SKILL.md
- Content audit in `docs/audit/`

### Changed
- hope plugin version 0.3.0 → 0.4.0 (strategic frameworks + 4 tools)
- wordsmith plugin version 0.0.3 → 0.0.4 (Open Loop framework)
- product plugin version 0.0.2 → 0.0.3 (JTBD, Systems Archetypes references)
- career plugin version 0.0.2 → 0.0.3 (10/10/10, Feynman references)
- founder plugin version 0.0.2 → 0.0.3 (Regret Minimization reference)
- Thinking tools count 30 → 34
- Frameworks now separate from tactical tools (strategic vs tactical)

---

## [0.3.0] - 2025-12

### Added
- **8 new thinking tools** in `hope/skills/soul/references/tools/`:
  - Razors: Occam's Razor, Hanlon's Razor
  - Fallacies: Sunk Cost Fallacy
  - Prioritization: Pareto Principle (80/20)
  - Risk: Pre-Mortem Analysis (Gary Klein)
  - Boundaries: Circle of Competence, Chesterton's Fence
  - Problem Structure: MECE Principle (McKinsey)
- **Regret Minimization Framework** in `founder/skills/founder/references/`
- **Feynman Technique** in `career/skills/career/references/`
- 4 new tool categories in SKILL.md (Razors, Fallacies, Risk, Boundaries)

### Changed
- hope plugin version 0.2.0 → 0.3.0 (8 new tools)
- Tools count 22 → 30

---

## [0.2.0] - 2025-12

### Added
- **22 Thinking Tools** in `hope/skills/soul/references/tools/`:
  - Root Cause: Ishikawa (fishbone), Iceberg Model
  - Domain: Cynefin Framework
  - Decision: OODA Loop, Ladder of Inference, Decision Matrix, Hard Choice Model
  - Prioritization: Eisenhower Matrix, Impact-Effort Matrix
  - Systems: Second-Order Thinking, Feedback Loops, Connection Circles, Concept Map
  - Creative: Six Thinking Hats, Zwicky Box, Abstraction Ladder, Productive Thinking
  - Communication: Minto Pyramid (SCQA), SBI Feedback, Conflict Resolution
  - Problem Structure: Issue Trees (MECE), First Principles
- Tools index table in `hope/skills/soul/SKILL.md`
- Cross-references to thinking tools in trace, product, founder, career, wordsmith skills
- PHILOSOPHY.md with core principles
- CHANGELOG.md with version history
- Career plugin to README plugin list
- Changelog section to CLAUDE.md with commit guidelines
- Install section to docs/hope.md (consistency with other plugins)
- Version field to product, founder, career skill frontmatter

### Changed
- Categories now use `core` (hope) and `domain` (satellites)
- CLAUDE.md structure diagram reflects all 5 plugins
- Quality footer now includes "Key Assumption" field (CLAUDE.md)
- Reference file rule clarified: intra-plugin sharing allowed
- Plugin.json structure documented with marketplace.json note
- hope plugin version 0.1.2 → 0.2.0 (thinking tools)
- career plugin version 0.0.1 → 0.0.2 (tool references)
- founder plugin version 0.0.1 → 0.0.2 (tool references)
- product plugin version 0.0.1 → 0.0.2 (tool references)
- wordsmith plugin version 0.0.2 → 0.0.3 (tool references)

### Fixed
- Version mismatch in hope/skills/soul/SKILL.md (0.0.1 → 0.1.2)
- "cVoice" typo in marketplace.json
- Missing version field in product/founder/career SKILL.md frontmatter

---

## [0.1.2] - 2025-12

### Added
- `/hope:intent` command for clarification protocol

---

## [0.1.1] - 2025-12

### Added
- Career plugin with 10 commands (assess, simulate, star, gap, drill, eval-comm, stakeholder, reframe, focus, osint)
- Founder plugin with 8 commands (validate, market-size, compete, pitch, investor-prep, financials, launch, board)
- Founder power user reference docs
- Career power user reference docs

### Fixed
- Missing hookEventName in UserPromptSubmit hook
- Career plugin.json name, description, and keywords

---

## [0.1.0] - 2025-12

### Added
- Learnings recall skill with auto-triggering
- Learnings compaction command
- Smart gating for learnings
- User documentation for all plugins
- `/document` command for repo maintenance

### Changed
- Documentation rewritten with progressive disclosure
- Keyword-first approach in docs
- Simplified update instructions
- Cut journey tutorials, consolidated navigation (-54% docs)

---

## [0.0.2] - 2025-11

### Added
- Hope plugin (soul, gate, trace, recall skills)
- Product plugin (prd, compete, research, metrics, cohort, prd-eval, debt)
- Wordsmith plugin (edit, voice, narrative, copy, blog-eval)
- Session lifecycle hooks
- Learnings system (`~/.claude/learnings/`)

### Changed
- Initial public structure

---

## Notes

- **hope** is the core plugin (category: `core`)
- **product**, **wordsmith**, **founder**, **career** are domain plugins (category: `domain`)
- Domain plugins recommend but don't require hope
- Versioning applies to the marketplace; individual plugins have their own versions in plugin.json
