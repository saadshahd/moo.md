# Trust Ladder

Graduated delegation with explicit gates and rollback mechanisms.

## Stages

| Stage | Agent Does | Trust Gate | Undo Mechanism |
|-------|------------|------------|----------------|
| **1. OBSERVE** | Monitors, surfaces insights | Default | N/A |
| **2. DRAFT** | Proposes actions, human approves | 10 correct suggestions | Human doesn't approve |
| **3. ACT W/GUARDRAILS** | Acts within tight constraints | 50 correct drafts + opt-in | Immediate rollback |
| **4. ACT W/TRUST** | Acts freely, human audits after | 90 days no errors + explicit grant | Post-hoc reversal |

## Stage Details

### Stage 1: Observe

- Passive monitoring only
- Highlights patterns, anomalies
- No action recommendations
- Building baseline understanding

### Stage 2: Draft

- Proposes specific actions
- Human reviews before execution
- Agent explains reasoning
- Building judgment calibration

**Gate to Stage 3:**
- 10 consecutive correct suggestions
- No false positives that would have caused harm
- Demonstrated understanding of constraints

### Stage 3: Act with Guardrails

- Executes within defined boundaries
- Hard limits on scope, impact, resources
- Human notified of actions taken
- Can be immediately rolled back

**Guardrail Examples:**
- Max file size / line count changes
- Approved directories only
- No external API calls
- No deletion without confirmation

**Gate to Stage 4:**
- 50 correct actions at Stage 3
- No guardrail violations
- 90 days elapsed
- Explicit human grant (not automatic)

### Stage 4: Act with Trust

- Full autonomy within domain
- Human audits periodically, not per-action
- Post-hoc correction if needed
- Highest efficiency, highest risk

## Revocation Triggers

| Trigger | Drop To |
|---------|---------|
| Single high-severity mistake | Stage 1 |
| Pattern of minor errors | Stage 2 |
| Guardrail violation | Stage 2 |
| Context change (new domain) | Stage 1 |
| Extended absence (30+ days) | Previous stage |

## Mistake Recovery Protocol

1. **Acknowledge** — Confirm the error, no defensiveness
2. **Rollback** — Execute undo mechanism immediately
3. **Analyze** — Root cause, not blame
4. **Adjust** — Modify guardrails or training
5. **Re-earn** — Restart trust accumulation from dropped stage

## Domain Scoping

Trust is domain-specific. Stage 4 for "code formatting" does not grant Stage 4 for "database migrations."

| Domain | Independent Trust Track |
|--------|------------------------|
| Code style / formatting | Low stakes, fast progression |
| Test writing | Medium stakes |
| Production changes | High stakes, slow progression |
| External communications | Highest stakes |
