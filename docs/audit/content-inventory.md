# Content Inventory - Gap Analysis

**Date**: 2025-12-13 (Updated)
**Source**: `~/Downloads/prompts/` vs existing moo.md
**PRD Reference**: `~/.claude/plans/dreamy-squishing-pebble.md`

## Executive Summary

**The shallow audit was wrong.** Most Downloads prompts duplicate what moo.md already has.

| Category                      | Count | Reality                                       |
| ----------------------------- | ----- | --------------------------------------------- |
| Already covered by moo.md     | ~500  | Product, founder, career, wordsmith skills    |
| True gaps (new functionality) | ~50   | Agent design, sales, consulting, visual tools |
| Partial overlap (variants)    | ~100  | Spreadsheet series, deck templates            |
| Discards                      | ~36   | Vertical-specific, platform-specific          |

## What moo.md ALREADY Has

### 8 Skills, 33 References, 44 Commands

| Plugin        | Skill                     | References | Commands | Covers                                                                 |
| ------------- | ------------------------- | ---------- | -------- | ---------------------------------------------------------------------- |
| **hope**      | soul, gate, trace, recall | 4          | 11       | Cognitive OS, debugging, verification, learnings                       |
| **product**   | product                   | 7          | 7        | PRD, compete, metrics, research, cohort, debt                          |
| **founder**   | founder                   | 8          | 8        | Validate, market-size, pitch, board, launch, financials                |
| **career**    | career                    | 10         | 10       | Assess, simulate, star, gap, drill, stakeholder, reframe, focus, osint |
| **wordsmith** | writing                   | 5          | 5        | Voice, editing, narrative, copy, eval                                  |

### prompts/tools.md: 25+ Mental Models

Already listed: Cynefin, OODA, Ishikawa, Eisenhower, Iceberg, Decision Matrix, Impact-Effort, Second-order thinking, Feedback loops, etc.

---

## Downloads Prompts: Coverage Analysis

### ALREADY COVERED (~500 prompts)

These Downloads prompts duplicate existing moo.md functionality:

| Downloads Prompt              | Covered By                                                    |
| ----------------------------- | ------------------------------------------------------------- |
| Create a PRD                  | product/references/prd.md                                     |
| PRD Evaluation                | product/references/prd-eval.md                                |
| Competitive Analysis          | product/references/compete.md + founder/references/compete.md |
| Market Size Calculator        | founder/references/market-size.md                             |
| Technical Debt Prioritization | product/references/debt.md                                    |
| Research Synthesis            | product/references/research.md                                |
| Cohort Analysis               | product/references/cohort.md                                  |
| Metrics/Goal Setting          | product/references/metrics.md                                 |
| Pitch Deck                    | founder/references/pitch.md                                   |
| Board Deck                    | founder/references/board.md                                   |
| Investor Q&A Prep             | founder/references/investor-prep.md                           |
| Launch Plan                   | founder/references/launch.md                                  |
| Financial Models              | founder/references/financials.md                              |
| Idea Validation               | founder/references/validate.md                                |
| AI Fluency Assessment         | career/references/assess.md                                   |
| Interview Simulation          | career/references/simulate.md                                 |
| STAR-C Stories                | career/references/star.md                                     |
| Gap Analysis                  | career/references/gap.md                                      |
| Stakeholder Navigation        | career/references/stakeholder.md                              |
| Reframe/Perspective           | career/references/reframe.md                                  |
| Focus/Energy                  | career/references/focus.md                                    |
| Job OSINT                     | career/references/osint.md                                    |
| Voice Extraction              | wordsmith/references/voice.md                                 |
| Editing/Fluff Cutting         | wordsmith/references/editing.md                               |
| Narrative Structure           | wordsmith/references/narrative.md                             |
| Microcopy/Tone                | wordsmith/references/copy.md                                  |
| Content Evaluation            | wordsmith/references/eval.md                                  |
| Debugging/Root Cause          | hope:trace                                                    |
| Verification/Gate             | hope:gate                                                     |
| Intent Clarification          | /hope:intent                                                  |
| Planning                      | /hope:plan                                                    |
| Postmortem                    | /hope:postmortem                                              |

### TRUE GAPS (~50 prompts worth building)

These are NOT in moo.md and represent genuine opportunities:

#### 1. Agent Design (17 prompts → NEW PLUGIN?)

| Prompt                  | Value  | Notes                      |
| ----------------------- | ------ | -------------------------- |
| Agent Design Prompt     | HIGH   | General agent architecture |
| Agent Error Handling    | HIGH   | Error design patterns      |
| Agent Guardrails        | HIGH   | Safety constraints         |
| Agent MCP Integration   | HIGH   | Claude Code specific       |
| Agent Workflow Mapping  | MEDIUM | Flow design                |
| Agent Test Scenarios    | MEDIUM | Testing framework          |
| Agent Human-in-the-Loop | MEDIUM | Escalation patterns        |
| Agent SOP Templates     | LOW    | Documentation              |

**Recommendation**: New `agent` plugin or add to hope

#### 2. Sales Workflows (completely missing)

| Prompt                     | Value  | Notes                  |
| -------------------------- | ------ | ---------------------- |
| Discovery Call Prep        | HIGH   | Pre-call research      |
| Deal Desk Guard            | HIGH   | Deal approval workflow |
| Pipeline Health Assessment | MEDIUM | Sales analytics        |
| Account Planning           | MEDIUM | CSM workflows          |
| Customer Onboarding Plan   | MEDIUM | Success workflows      |
| Sales Email Templates      | LOW    | Copy templates         |

**Recommendation**: New `sales` plugin or add to founder

#### 3. Consulting Workflows (completely missing)

| Prompt                  | Value  | Notes              |
| ----------------------- | ------ | ------------------ |
| Client Deliverable QA   | HIGH   | Quality checklist  |
| Proposal Generation     | MEDIUM | Proposal templates |
| Unfair Advantage Finder | MEDIUM | Positioning tool   |
| Outbound/Cold Email     | LOW    | Outreach templates |

**Recommendation**: Add to founder (they overlap)

#### 4. Thinking Tools → Skill Output Enhancement

`prompts/tools.md` lists names only. Here's WHERE each tool adds value to existing skill OUTPUTS:

| Tool                      | Best Skill               | Current Output              | Enhanced Output                                                                                |
| ------------------------- | ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------- |
| **Ishikawa/Fishbone**     | hope:trace               | "Contributing Factors" list | ASCII fishbone diagram showing Process/People/Technical/Context branches                       |
| **Cynefin**               | hope:soul                | Workflow A/B/C selection    | ASCII quadrant to classify task as Simple/Complicated/Complex/Chaotic BEFORE choosing workflow |
| **OODA Loop**             | hope:gate                | Verification checklist      | ASCII cycle for rapid Observe→Orient→Decide→Act during iterative work                          |
| **Eisenhower Matrix**     | product:debt             | Priority 1/2/3 tiers        | ASCII 2x2 grid placing items in Urgent/Important quadrants                                     |
| **Impact-Effort Matrix**  | product:debt             | Prioritization formula      | ASCII 2x2 grid visualizing Impact vs Cost tradeoff                                             |
| **Decision Matrix**       | hope:soul (decisions.md) | Reversibility filter        | ASCII weighted scoring table for multi-criteria decisions                                      |
| **Iceberg Model**         | hope:trace               | Five Whys                   | ASCII iceberg showing Events→Patterns→Structures→Mental Models layers                          |
| **Second-order Thinking** | hope:soul                | Inversion checklist         | ASCII consequence tree showing 2nd/3rd order effects                                           |
| **Ladder of Inference**   | career:stakeholder       | Stakeholder matrix          | ASCII ladder showing Data→Selection→Meaning→Assumptions→Conclusions                            |
| **Feedback Loops**        | product:research         | Signal extraction           | ASCII loop diagrams showing Reinforcing (R) and Balancing (B) dynamics                         |

**Implementation approach:** Don't create new skills. ADD ASCII sections to existing skill outputs.

**Example: Enhance hope:trace output**

```
Current output:
## Contributing Factors
- Process: Monitoring gaps
- People: Unclear ownership
- Technical: Capacity limits

Enhanced output:
## Contributing Factors (Ishikawa)
```

```
                     ┌─ Monitoring gaps
            Process ─┼─ Testing gaps
                     └─ Review gaps
                            │
                     ┌─ Unclear ownership
             People ─┤
                     └─ Missing runbooks
                            │
                     ┌─ Capacity limits         ──────┐
          Technical ─┼─ Config drift                  │──► [EFFECT]
                     └─ Dependency failures   ──────┘
                            │
                     ┌─ Traffic spike
            Context ─┤
                     └─ Deployment timing
```

```

**Recommendation**: Add ASCII enhancement sections to 4-5 existing references

#### 5. Meta-Prompts (not in moo.md)

| Prompt | Value | Notes |
|--------|-------|-------|
| Prompt Improver | HIGH | Meta-optimization |
| Question Generator Mode | HIGH | Socratic method |
| Meta-Meta-Prompt Generator | LOW | Recursive meta |

**Recommendation**: Add to hope as reference

#### 6. Cognitive Tools (not in moo.md)

| Prompt | Value | Notes |
|--------|-------|-------|
| Blind Spot Mirror | HIGH | Bias detection |
| Regret Minimization Frame | HIGH | Bezos decision framework |
| Open Loop Audit | MEDIUM | GTD-style capture |
| Memory Palace Generator | LOW | Learning technique |

**Recommendation**: Add to hope as references

#### 7. Visual/Design (completely missing)

| Prompt | Value | Notes |
|--------|-------|-------|
| Visual Design Direction | MEDIUM | Design system generation |
| Front-End Look & Feel Hunt | MEDIUM | Reference finding |

**Recommendation**: New `design` plugin or add to wordsmith

### PARTIAL OVERLAP (~100 prompts - variants of existing)

These exist in moo.md but Downloads has additional variants:

| Downloads | moo.md Equivalent | Gap |
|-----------|-------------------|-----|
| Spreadsheet s1-s5 series | founder/financials.md | Step-by-step vs overview |
| Crisis Management Deck | founder/board.md | Different template |
| Product Launch Deck | founder/pitch.md | Different focus |
| All-Hands Deck | founder/board.md | Different audience |
| QBR Deck | founder/board.md | Different structure |
| Marketing evaluators | wordsmith/eval.md | Marketing-specific criteria |

**Recommendation**: These are nice-to-have variants, not priorities

### DISCARDS (~36 prompts)

| Category | Count | Reason |
|----------|-------|--------|
| Vertical-specific | 12 | Dentist, plumber, HVAC, etc. |
| Platform-specific | 6 | Notion templates, ChatGPT-specific |
| Low-value duplicates | 18 | Career assessments already covered |

---

## Revised Phase 2 Recommendations

### Priority 1: Enhance Existing Skill Outputs with ASCII (2 story points)

Don't create new references. ADD ASCII sections to existing SKILL.md/references:

| Skill to Modify | Add Tool | Implementation |
|-----------------|----------|----------------|
| `hope/skills/trace/SKILL.md` | Ishikawa | Add ASCII fishbone to Contributing Factors section |
| `hope/skills/soul/SKILL.md` | Cynefin | Add ASCII quadrant before Workflow Selection section |
| `product/skills/product/references/debt.md` | Eisenhower | Add ASCII 2x2 grid to Priority Tiers section |
| `hope/skills/soul/references/decisions.md` | Decision Matrix | Add ASCII weighted scoring table |

**Files to modify**: 4 existing files
**Lines to add**: ~30-50 per file

### Priority 2: New Plugin - agents (5 story points)

The 17 agent design prompts represent a TRUE GAP. Create:

```

agents/
├── .claude-plugin/plugin.json
├── skills/agents/
│ ├── SKILL.md (router)
│ └── references/
│ ├── design.md (agent architecture)
│ ├── guardrails.md (safety constraints)
│ ├── mcp.md (MCP integration)
│ └── testing.md (test scenarios)
└── commands/
└── agent.md

```

### Priority 3: Extend founder with Sales (2 story points)

Add 2-3 references to founder:
- `founder/skills/founder/references/discovery.md` (discovery call prep)
- `founder/skills/founder/references/deal.md` (deal desk guard)

### NOT Priority (defer)

- Spreadsheet s1-s5 series (too granular, financials.md is enough)
- Deck variants (board.md + pitch.md cover the patterns)
- Visual/design tools (low frequency for Claude Code users)
- Video prompts (niche AI video generation)
- Consulting workflows (overlap with founder)
- Meta-prompts (hope:soul already covers intent clarification)

---

## Summary

| Previous Audit | Reality |
|----------------|---------|
| "220 unique prompts to add" | ~50 true gaps (most already in moo.md) |
| "All 10 PRD tools missing" | Names in tools.md, need ASCII in skill outputs |
| "Create new references for tools" | Modify 4 existing files instead |
| "Thinking tools highest priority" | Agent design is the REAL gap |

**True priority order:**
1. **ASCII enhancements** to 4 existing skill files (Ishikawa→trace, Cynefin→soul, Eisenhower→debt, Decision Matrix→decisions)
2. **New agents plugin** (17 prompts → genuine missing capability)
3. **Sales references** to founder (discovery, deal desk)

**Total work:**
- Priority 1: 2 story points (modify 4 files)
- Priority 2: 5 story points (new plugin)
- Priority 3: 2 story points (2 new references)
- **Total: 9 story points**

---

## Files to Modify (Priority 1)

```

hope/skills/trace/SKILL.md # Add Ishikawa fishbone ASCII
hope/skills/soul/SKILL.md # Add Cynefin quadrant ASCII
product/skills/product/references/debt.md # Add Eisenhower ASCII
hope/skills/soul/references/decisions.md # Add Decision Matrix ASCII

```

## Files to Create (Priority 2)

```

agents/.claude-plugin/plugin.json
agents/skills/agents/SKILL.md
agents/skills/agents/references/design.md
agents/skills/agents/references/guardrails.md
agents/skills/agents/references/mcp.md
agents/skills/agents/references/testing.md
agents/commands/agent.md

```

## Files to Create (Priority 3)

```

founder/skills/founder/references/discovery.md
founder/skills/founder/references/deal.md

```

## Previous Shallow Analysis

| Agent | Categories | Files | Unique | Discards |
|-------|------------|-------|--------|----------|
| Agent 1 | founder, work-better, spreadsheets | 296 | ~100 | ~12 vertical-specific |
| Agent 2 | decisioning, product, engineering, career, marketing | 233 | ~95 | ~40 duplicates |
| Agent 3 | sales, research, writing, vibe-coding, consulting, ai-agents, presentations, video, design | 155 | ~87 | ~20 duplicates |
| **Total** | 17 categories | 686 | ~220 unique | ~70 discards |

## Phase 2 Recommendations

### High-Value Thinking Tools (for hope plugin)

These prompts are most aligned with the PRD's goal of building thinking frameworks:

| Prompt | Value | Reason |
|--------|-------|--------|
| Blind Spot Mirror | HIGH | Cognitive bias detection - direct mental model |
| Goal System Designer | HIGH | SMART goals + tracking - structured framework |
| Question Generator Mode | HIGH | Interrogative thinking - Socratic method |
| Regret Minimization Frame | HIGH | Bezos decision framework - structured thinking |
| Fresh Perspective Generator | HIGH | Problem reframing - creative thinking |
| Stakeholder Navigation Guide | HIGH | Political mapping - systems thinking |
| 24 Hour Leader Pulse | MEDIUM | Daily reflection - structured habit |
| Hidden Meeting Pattern Detector | MEDIUM | Calendar audit - productivity tool |
| Automation Gold Mine Finder | MEDIUM | Process analysis - systems thinking |
| Research Launch Pad | MEDIUM | Research kickoff - structured planning |

### Prompt Distribution by Plugin Target

| Plugin | Keep | Merge | Discard | Notes |
|--------|------|-------|---------|-------|
| **hope** | ~45 | ~15 | 0 | Thinking tools, meta-prompts, decision frameworks |
| **founder** | ~70 | ~20 | 0 | Financial models, startup, board decks |
| **product** | ~35 | ~10 | 0 | PRDs, competitive analysis, roadmaps |
| **career** | ~25 | ~10 | 0 | Interview prep, skill assessments |
| **wordsmith** | ~30 | ~5 | 0 | Writing, presentations, copy |
| **discard** | 0 | 0 | ~12 | Vertical-specific (dentist, plumber, etc.) |

### Key Findings

1. **PRD tools already exist**: All 10 tools (Cynefin, OODA, etc.) are in `prompts/tools.md`
2. **35% duplication rate**: 242 files are duplicates across categories
3. **12 low-value discards**: Vertical-specific templates (healthcare, trades)
4. **Strong founder/product coverage**: Most prompts support startup workflows
5. **Hope plugin gap**: Existing prompts focus on practical tools, not pure mental models

### Recommendation for Phase 2

**Option A (Recommended)**: Focus on the 10 thinking tools from Downloads/prompts that map to hope:
1. Convert Blind Spot Mirror → hope reference
2. Convert Goal System Designer → hope reference
3. Convert Question Generator Mode → hope reference
4. Convert Regret Minimization Frame → hope reference
5. Convert Fresh Perspective Generator → hope reference
6. Create ASCII visuals for Cynefin, OODA, Ishikawa (from tools.md)
7. Create ASCII visuals for Eisenhower, Decision Matrix (from tools.md)

**Option B**: Build the 4 core frameworks first (ABC, Systems, Scoping, Patterns) as new content, then add tools.

## Full Inventory Tables

### Founder Plugin (70+ prompts)

| Name | Action | Dup | Notes |
|------|--------|-----|-------|
| Board Deck Generator | keep | 3 | Executive presentations |
| Board Package from Existing Data | keep | 2 | Board materials |
| Narrative Arc Builder (Jobsian) | keep | 5 | Product storytelling |
| Product Idea Vetting | keep | 2 | Validation framework |
| Risk Analyzer Coach | keep | 2 | Risk assessment |
| Rapid Market Sizing Sprint | keep | 3 | TAM/SAM/SOM |
| Market Size Calculator | keep | 3 | TAM/SAM/SOM |
| Crisis Management Deck Builder | keep | 3 | Crisis comms |
| Quarterly Business Review Deck | keep | 3 | QBR presentations |
| Pricing Experiment Matrix | keep | 5 | Pricing strategy |
| Financial Storyteller | keep | 2 | Metrics to narrative |
| Launch Readiness Gate | keep | 3 | Go/no-go decision |
| Launch Execution Playbook | keep | 2 | 90-day plan |
| All s1-s5 series | keep | varies | Financial model builders |

### Hope Plugin (45+ prompts)

| Name | Action | Dup | Notes |
|------|--------|-----|-------|
| Blind Spot Mirror | keep | 3 | Cognitive bias detection |
| Goal System Designer | keep | 4 | SMART goals + tracking |
| Question Generator Mode | keep | 4 | Interrogative thinking |
| Regret Minimization Frame | keep | 2 | Bezos decision framework |
| Fresh Perspective Generator | keep | 3 | Problem reframing |
| Stakeholder Navigation Guide | keep | 5 | Political mapping |
| Prompt Improver | keep | 4 | Meta-prompt optimization |
| Research Launch Pad | keep | 4 | Research kickoff |
| Hidden Meeting Pattern Detector | keep | 4 | Calendar audit |
| Automation Gold Mine Finder | keep | 4 | Process automation |
| 24 Hour Leader Pulse | keep | 5 | Daily reflection |
| Open Loop Audit | keep | 2 | GTD-style open loops |
| Memory Architecture Designer | keep | 2 | LLM memory design |
| Context Library Builder | keep | 1 | Context management |
| Agent Design Prompt | keep | 1 | Agent architecture |
| All agent prompts | keep | varies | Agent design patterns |

### Product Plugin (35+ prompts)

| Name | Action | Dup | Notes |
|------|--------|-----|-------|
| Create a PRD | keep | 2 | PRD template |
| Rigorous PRD Evaluation | keep | 2 | PRD quality |
| Product Roadmap Builder | keep | 3 | Roadmap visualization |
| Technical Debt Prioritization | keep | 2 | Debt scoring |
| Competitive Intelligence Scanner | keep | 3 | OSINT analysis |
| Competitor Feature Teardown | keep | 3 | Feature comparison |
| Delivery Sprint Planner | keep | 3 | Sprint planning |
| Product Launch Deck | keep | 3 | GTM presentations |
| All cohort/saas series | keep | varies | SaaS metrics |

### Career Plugin (25+ prompts)

| Name | Action | Dup | Notes |
|------|--------|-----|-------|
| AI Fluency Assessment | keep | 2 | AI skill evaluation |
| Interview Role Deconstruction | keep | 1 | Job requirements parser |
| STAR-C Narrative Story Builder | keep | 1 | Interview stories |
| Live Interview Simulator | keep | 1 | Practice tool |
| Leadership Weak Spot Scan | keep | 2 | Leadership gaps |
| All career assessments | merge | varies | Consolidate similar |

### Wordsmith Plugin (30+ prompts)

| Name | Action | Dup | Notes |
|------|--------|-----|-------|
| Voice Print Extractor | keep | 2 | Writing style analysis |
| Precision Doc Edit | keep | 2 | Fluff cutting |
| UX Copy Tone Swap | keep | 3 | Tone adjustment |
| Corporate Style Extractor | keep | 2 | Brand voice extraction |
| Corporate Style Applicator | keep | 2 | Brand voice application |
| Blog Post Quality Evaluator | keep | 2 | Content QA |
| All video prompts | keep | 1 | Cinematic generation |
| All presentation prompts | keep | varies | Deck building |

### Discards (12 prompts)

| Name | Reason |
|------|--------|
| Dentist Treatment Plan Letter | Vertical-specific |
| Plumber Repiping Estimate | Vertical-specific |
| HVAC Contractor Estimate | Vertical-specific |
| General Contractor Remodel | Vertical-specific |
| Electrician Panel Upgrade | Vertical-specific |
| Wedding Planner Proposal | Vertical-specific |
| Landscaper Backyard Renovation | Vertical-specific |
| Veterinarian Surgery Recommendation | Vertical-specific |
| Family Physician SOAP Notes | Vertical-specific |
| Universal Meta-Prompt for ChatGPT 5 | Competitor-specific |
| Interview Coach Agent Template (Notion) | Platform-specific |
| Prompt Evaluation System (Notion) | Platform-specific |

```
