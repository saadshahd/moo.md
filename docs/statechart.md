# Statechart — Canonical Reference

Single source of truth for hope plugin behavior. Skills implement this statechart. When this file changes, update affected skills to match.

**How to read:** Section 1 shows the full pipeline at a glance. Sections 2–7 expand each composite state. Section 8 maps hooks/commands to states. Section 9 lists cross-cutting rules.

---

## 1. Top-Level Pipeline

```mermaid
stateDiagram-v2
  [*] --> user_need

  state "soul (parallel — every turn, see §7)" as soul

  state route <<choice>>
  user_need --> route

  state "intent (clarification)" as intent
  state "shape (approach selection)" as shape
  state "loop (execution)" as loop
  state "consult (expert system)" as consult

  route --> intent : all session types
  route --> shape : obvious (spec ≥ 8)

  intent --> shape : Build / Debug / Plan (spec ≥ 5, approach known)
  intent --> consult : Reflect (spec ≥ 5)
  intent --> consult : Build / Debug / Plan (spec ≥ 5, approach unknown → explore)

  consult --> shape : explore mode (user picks path)
  shape --> consult : Build / Debug / Plan (validate approach)
  consult --> loop : Build / Debug
  consult --> completed : Plan / Reflect (output delivered)

  loop --> completed : user satisfied
  completed --> [*]
  completed --> user_need : feedback yields new work

  soul --> intent : CLARIFY (spec < 5)
  soul --> shape : EXPLORE (fit < 15)

  loop --> intent : wrong intent (see §8)
  loop --> shape : reshape needed
```

### Session Types

Soul detects type from the user's first message. Sets skill composition for the session.

| Type        | Signals                                           | Pipeline                                   |
| ----------- | ------------------------------------------------- | ------------------------------------------ |
| **Build**   | "build", "implement", "create", "add"             | intent → shape → consult → loop            |
| **Debug**   | "fix", "bug", "error", "broken"                   | intent (diagnose) → shape → consult → loop |
| **Plan**    | "plan", "design", "architect", "explore"          | intent → shape → consult → output          |
| **Reflect** | "postmortem", "review session", "what went wrong" | intent → consult → output                  |

### Engagement Level Effects

Engagement does not change state topology — it changes interaction density within states. Set once per session.

| Skill   | Autonomous                   | Collaborative (default)         | Guided                       |
| ------- | ---------------------------- | ------------------------------- | ---------------------------- |
| intent  | Consult auto-clarifies       | User + consult co-clarify       | User drives                  |
| shape   | Consult shapes, auto-selects | Consult shapes, user approves   | User drives, consult advises |
| loop    | Tool shape, milestones only  | Tool-Review, checkpoints        | Colleague, iterate each step |
| consult | Auto-invoked on stalls       | Invoked at decision points      | Only on explicit request     |
| unstuck | Consult auto-unblocks        | Consult unblocks, user informed | User unblocks                |

---

## 2. Intent Detail

```mermaid
stateDiagram-v2
  [*] --> acknowledge

  state "acknowledge\nTASK / CONTEXT / DONE / STAKES / REVIEWS" as acknowledge
  state "clarify\nMCQ rounds, until no question would change brief" as clarify
  state score_check <<choice>>
  state "echo_check\ndeliverable + constraint + must-include" as echo_check
  state "refine\nbest guess + assumptions + 1 question" as refine
  state "emit_brief\nobjective, non-goals, constraints,\nacceptance, stop conditions" as emit_brief

  acknowledge --> clarify
  clarify --> score_check : score spec (5 dimensions, 0-10)

  score_check --> emit_brief : ≥ 8
  score_check --> echo_check : 5–7
  score_check --> clarify : < 5

  echo_check --> emit_brief : YES
  echo_check --> refine : EDITS
  refine --> score_check : re-score

  clarify --> emit_brief : "proceed anyway" (max 3 rounds)

  emit_brief --> [*]
```

**Session-type adaptation:** Debug focuses on symptom / changed / expected. Plan focuses on decision / options / criteria. Reflect focuses on outcome / surprised / change.

---

## 3. Shape Detail

```mermaid
stateDiagram-v2
  [*] --> extract

  state "extract_intent\ngoal, constraints, scope" as extract
  state "expert_consultation\ndomain panel on intent brief" as expert
  state "synthesize\nfindings → mode + criteria + mustNot" as synthesize
  state "output_shape\nshape + criteria[]\n+ mustNot[] + tensions" as output

  extract --> expert
  expert --> synthesize
  synthesize --> output
  output --> [*]
```

**Expert consult:** Default: invoke panel consultation after extract. Expert findings drive mode recommendation (Colleague / Tool-Review / Tool) with cited evidence. Safety valve: high-risk or irreversible findings → minimum Tool-Review. Default when uncertain: Tool-Review. Skip only for trivial tasks (single obvious change, clear precedent, no ambiguity, low risk, trivially reversible).

**Pre-mortem gate:** After synthesize→output, when risk tier = Critical (13+ points OR irreversible OR auth/data/infra): emit `premortem:` alongside criteria[] and mustNot[]. Skipped for Trivial/Standard.

**Engagement annotations:**

- Autonomous: consult shapes, auto-selects
- Collaborative: consult shapes, user approves selection
- Guided: user drives, consult advises on request

---

## 4. Loop Detail

```mermaid
stateDiagram-v2
  [*] --> spec_scoring

  state "spec_scoring\nre-score or use intent score\nroute by fit score" as spec_scoring
  state "shape_approval\nYes / Edit / Cancel" as shape_approval
  state "decompose\natomic work items\n[LOOP] announcement" as decompose
  state "wave_execution\nidentify ready → spawn subagents\n→ collect → scope review → log" as wave_exec
  state "stall_detection\nno progress on wave" as stall
  state "expert_review\nthorough panel vs spec + mustNot\nBLOCKER / WARNING / SUGGESTION" as expert_review
  state "verify_gate\nthorough tier → post-work gate" as verify_gate
  state "review_feedback\njourney summary → probe question\n→ feedback" as review_feedback
  state "cancel\nacknowledge + report progress\ncurrent wave completes first" as cancel
  state "circuit_breaker\nmax iterations or budget exceeded" as circuit_break
  state "paused\noffer: continue or stop" as paused

  spec_scoring --> shape_approval
  shape_approval --> decompose : Yes
  shape_approval --> spec_scoring : Edit (re-shape)
  shape_approval --> [*] : Cancel

  decompose --> wave_exec
  wave_exec --> wave_exec : next wave
  wave_exec --> expert_review : all items done

  wave_exec --> stall : no progress
  stall --> wave_exec : consult unblock
  stall --> wave_exec : user unblock

  expert_review --> wave_exec : BLOCKER (new items)
  expert_review --> verify_gate : no blockers

  verify_gate --> wave_exec : gate fails (remediation items)
  verify_gate --> review_feedback : gate passes

  review_feedback --> spec_scoring : new work from feedback
  review_feedback --> [*] : user satisfied

  wave_exec --> cancel : user cancel / stop / abort
  cancel --> [*] : current wave finishes

  wave_exec --> circuit_break : max iterations or budget
  circuit_break --> paused
  paused --> wave_exec : continue
  paused --> [*] : stop

  wave_exec --> [*] : mustNot violated (hard stop)
```

**Circuit breakers:** max iterations (user-configured) and budget exceeded (user-configured) pause for user decision. mustNot violated (from shape output) is a hard stop — these are inviolable constraints.

**Engagement annotations on wave_execution:**

- Autonomous (Tool shape): milestones only
- Collaborative (Tool-Review): checkpoint at major decisions
- Guided (Colleague): iterate each step together

---

## 5. Consult Detail

```mermaid
stateDiagram-v2
  state "Invocation Sources" as sources {
    soul_explore : soul routes (approach unknown → explore)
    shape_step : shape step 2 (domain consultation on intent brief)
    loop_stall : loop stall detect (auto-unblock)
    loop_review : loop expert review (thorough panel)
    user_cmd : /hope:summon or /hope:panel
  }

  state "load_blocklist\nuser preferences" as blocklist
  state mode_check <<choice>>

  sources --> blocklist
  blocklist --> mode_check : detect mode

  state "Single Expert" as single {
    detect_expert --> load_profile
    load_profile --> assess_coverage
    state conf_check <<choice>>
    assess_coverage --> conf_check
    conf_check --> generate : has documented positions
    conf_check --> refuse : no documented positions

    state "detect_expert\nname / keyword / file / domain" as detect_expert
    state "load_profile\ncurated or dynamic" as load_profile
    state "assess_coverage\nDocumented / Inferred / Extrapolated" as assess_coverage
    state "generate_response\nexpert voice + citations" as generate
    state "refuse\ninsufficient data to simulate" as refuse
  }

  state "Panel Mode" as panel {
    state panel_route <<choice>>
    panel_route --> select_experts : debate (default)
    panel_route --> review_select : thorough review

    select_experts --> debate
    debate --> surface_tensions
    surface_tensions --> synthesize

    state "select_experts\n2–4 relevant profiles" as select_experts
    state "debate\neach argues position" as debate
    state "surface_tensions\nmap disagreements" as surface_tensions
    state "synthesize\nconsensus + tradeoff + dissent" as synthesize

    review_select --> review_findings
    state "review_select\n3–4 experts (breadth)" as review_select
    state "review_findings\nvs spec + mustNot\nBLOCKER / WARNING / SUGGESTION" as review_findings
  }

  state "Explore Mode" as explore {
    explore_select --> brainstorm
    brainstorm --> shortlist
    shortlist --> user_pick

    state "explore_select\n3–4 cross-domain experts" as explore_select
    state "brainstorm\neach proposes distinct approach" as brainstorm
    state "shortlist\n2–4 viable paths + blind spots" as shortlist
    state "user_pick\nuser selects path → shape" as user_pick
  }

  state "Unblock Mode" as unblock {
    parse_blocker --> diagnose
    diagnose --> recommend
    recommend --> recommend : retry (max 3)
    recommend --> escalate : 3 failures
    escalate --> review_select : thorough review

    state "parse_blocker\ntask + error + failed approach" as parse_blocker
    state "diagnose\n2–3 diagnostic experts" as diagnose
    state "recommend\nconsensus recommendation" as recommend
    state "escalate\nthorough review" as escalate
  }

  mode_check --> detect_expert : single
  mode_check --> panel_route : panel / debate / review
  mode_check --> explore_select : explore / brainstorm
  mode_check --> parse_blocker : unblock / stuck
```

Consult may also be invoked by any skill via `Skill(skill="hope:consult", ...)`. The 5 modes cover the full spectrum from single-expert queries to generative discovery.

---

## 6. Bond Detail

```mermaid
stateDiagram-v2
  state "Invocation Sources" as sources {
    user_cmd : /hope:bond [task]
    shape_trigger : shape detects high Independence + large Scope
  }

  state "assess\n4 dimensions: Independence, File ownership,\nCoordination, Scope" as assess
  state fitness_check <<choice>>
  state "redirect\nexplain: subagent or solo" as redirect
  state "design\nroles, boundaries, models,\ncoupling check" as design
  state "confirm\nblueprint table → user approval" as confirm
  state "handoff\nemit creation spec → native tools" as create

  sources --> assess
  assess --> fitness_check
  fitness_check --> design : Team
  fitness_check --> redirect : Subagent or Solo
  design --> confirm
  confirm --> design : Adjust
  confirm --> create : Yes
  confirm --> [*] : Cancel
  create --> [*]
  redirect --> [*]
```

**Session-aware decomposition:** Tactical → maximize parallel. Strategic → phase by dependency chain. Existential → foundation layers first.

---

## 7. Soul Detail

```mermaid
stateDiagram-v2
  state "UserPromptSubmit hook fires" as hook

  hook --> check_marker
  state marker_check <<choice>>
  check_marker --> marker_check

  state "detect_type\nBuild / Debug / Plan / Reflect" as detect_type
  state "ask_engagement\nAutonomous / Collaborative / Guided\n+ Horizon (Tactical / Strategic / Existential)\n(once per session)" as ask_engagement
  state "silent_audit\n5-check gate: spec, fit, shape, verification, user confused" as audit
  state "quality_footer\nverdict + verification + risk\n(proportional to decision type)" as footer

  state check_marker : check [SESSION] marker

  marker_check --> detect_type : no marker
  marker_check --> audit : marker exists

  detect_type --> ask_engagement : non-trivial
  detect_type --> audit : trivial (default Guided)
  ask_engagement --> audit

  state audit_result <<choice>>
  audit --> audit_result

  audit_result --> footer : scores OK
  audit_result --> intent_interrupt : spec < 5
  audit_result --> explore_interrupt : fit < 15

  state "→ intent.acknowledge (CLARIFY)" as intent_interrupt
  state "→ shape.extract or gather context (EXPLORE)" as explore_interrupt

  footer --> [*]
  intent_interrupt --> [*] : hand-off to intent
  explore_interrupt --> [*] : hand-off to shape
```

**Session marker:** `[SESSION] Type: Build | Engagement: Collaborative | Horizon: Strategic | Feasible: time (2h)` — emitted after strategy set, maintained through conversation, preserved on compaction. Horizon defaults: Build/Plan → Strategic, Debug → Tactical, Reflect → Existential. Feasibility defaults: Build → solo, Debug → time, Plan/Reflect → none.

**Compaction resilience:** If marker lost, re-derive from conversation artifacts. If re-derivation fails, ask user. Be transparent about gaps.

---

## 8. Hooks and Commands

### Hooks

| Hook            | Trigger                            | State Effect                                                    |
| --------------- | ---------------------------------- | --------------------------------------------------------------- |
| `SessionStart`  | Session start/resume/clear/compact | Injects full soul SKILL.md into context via `session-start.sh`  |
| `SubagentStart` | Every subagent spawn               | Propagates [SESSION] + criteria + mustNot + compaction guidance |
| `PreToolUse:ExitPlanMode` | ExitPlanMode tool call    | Sequential deny chain: checks pipeline artifacts in order (intent → shape → coverage), denies on first missing, max 3 denials |

### Commands

| Command         | Entry State              | Notes                                      |
| --------------- | ------------------------ | ------------------------------------------ |
| `/hope:intent`  | `intent.acknowledge`     | Direct re-entry from any state             |
| `/hope:panel`   | `consult.load_blocklist` | Panel mode, parallel to current state      |
| `/hope:summon`  | `consult.load_blocklist` | Single mode, parallel to current state     |
| `/hope:block`   | (no state change)        | Modifies blocklist, affects future consult |
| `/hope:unblock` | (no state change)        | Removes from blocklist                     |
| `/hope:blocked` | (no state change)        | Read-only blocklist display                |
| `/hope:bond`    | `bond.assess`            | Team composition, standalone or from shape |
| `/hope:full`    | `soul.detect_type`       | Full pipeline orchestrator                 |

---

## 9. Cross-Cutting Rules

### Back-Transition Criteria

| From                 | To                 | Trigger           | Detection                                            |
| -------------------- | ------------------ | ----------------- | ---------------------------------------------------- |
| loop.spec_scoring    | intent.acknowledge | Wrong intent      | Spec re-score drops below 5                          |
| loop.wave_execution  | intent.acknowledge | Wrong intent      | Expert review flags intent mismatch                  |
| loop.wave_execution  | shape.extract      | Reshape needed    | Expert review flags approach failure + user confirms |
| loop.review_feedback | loop.spec_scoring  | New work          | User feedback adds requirements                      |
| shape (any)          | intent.acknowledge | Spec insufficient | Spec score found < 5 during extraction               |

Back-transition magnitude determines response: minor drift → inline adjustment, major mismatch → formal re-entry with user consent.

### Deadlock Prevention

Every cycle has a break condition:

| Cycle                         | Break Condition                                                       |
| ----------------------------- | --------------------------------------------------------------------- |
| intent clarify loop           | Max 3 rounds → "proceed anyway" with [ASSUMPTION] labels              |
| consult unblock retry         | Max 3 → escalate to thorough review                                   |
| loop wave execution           | Circuit breaker: max iterations / budget → pause. mustNot → hard stop |
| shape uncertain mode          | Default Tool-Review                                                   |
| soul audit → intent interrupt | Intent handles with its own max-round clarify loop                    |
| loop → intent back-transition | Intent's clarify loop has its own escape                              |
| bond adjust loop              | Max 3 revisions → proceed with current or cancel                      |
| cancel                        | Always available from loop                                            |

### Key Rules

- **Intent is sacred** — never changes without user consent
- **Shape changes must be communicated** — user always knows when approach shifts
- **Gates advise, never prevent** — user owns their work
- **Compaction preserve list:** [SESSION] marker (including Horizon + Feasible), criteria, mustNot, horizon, feasibility axis + bound, wave number, key decisions

---

## 10. Skill-to-State Mapping

| State Region                     | Primary Skill | Sub-States                                                                                                                                                                                                                |
| -------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| user_need → clarifying           | intent        | acknowledge, clarify, score_spec, echo_check, refine, emit_brief                                                                                                                                                          |
| clear_intent → session_execution | shape         | extract, expert_consultation, synthesize, output_shape                                                                                                                                                                    |
| session_execution                | loop          | spec_scoring, shape_approval, decompose, wave_execution, stall_detection, expert_review, verify_gate, review_feedback, cancel, circuit_breaker, paused                                                                    |
| (any stage)                      | consult       | load_blocklist, detect_mode — single: detect_expert, load_profile, assess_coverage, generate/refuse — panel: select_experts, debate, surface_tensions, synthesize — explore: explore_select, brainstorm, shortlist, user_pick — unblock: parse_blocker, diagnose, recommend, escalate |
| (parallel, always)               | soul          | hook_fires, check_marker, detect_type, ask_engagement, audit, quality_footer                                                                                                                                              |
| shape → loop (team path)         | bond          | assess, design, confirm_create                                                                                                                                                                                            |
