# Aspect Discovery

Identify which implementation dimensions are relevant to a task.

## The 12 Aspects

### Data

**Signals:** database, schema, model, entity, persist, store, record, table, document, state

**Questions:**
- What data structures change?
- Is this a new entity or modification to existing?
- What's the source of truth?
- Read-heavy or write-heavy?

**Ignore if:** Pure UI change, no persistence needed

---

### API

**Signals:** endpoint, route, request, response, REST, GraphQL, RPC, contract, interface

**Questions:**
- What contracts change?
- Who are the consumers?
- Breaking change risk?
- Versioning needed?

**Ignore if:** Internal function, no service boundary crossed

---

### UI

**Signals:** component, view, display, render, user, screen, page, interaction, click, input

**Questions:**
- What does the user see/do?
- Accessibility requirements?
- Responsive considerations?
- Loading/error states?

**Ignore if:** Backend-only change, no visual impact

---

### Auth

**Signals:** permission, role, access, security, token, session, authorize, authenticate, ACL

**Questions:**
- Who can access this?
- What permissions required?
- Audit logging needed?
- Rate limiting?

**Ignore if:** Public data, no access control

---

### Performance

**Signals:** fast, slow, scale, concurrent, cache, optimize, latency, throughput, load

**Questions:**
- What's the target latency?
- Expected load?
- Caching strategy?
- Database queries to optimize?

**Ignore if:** Low-traffic path, prototype, internal tool

---

### Error

**Signals:** fail, error, exception, recover, retry, fallback, resilience, timeout, circuit

**Questions:**
- What can fail?
- Recovery strategy?
- User-facing error messages?
- Monitoring/alerting?

**Ignore if:** Happy-path-only prototype

---

### Testing

**Signals:** test, verify, coverage, confidence, unit, integration, e2e, mock, fixture

**Questions:**
- What's the testing strategy?
- Unit vs integration vs e2e?
- Test data requirements?
- CI integration?

**Ignore if:** Spike/experiment, throwaway code

---

### Migration

**Signals:** existing, legacy, transition, migrate, upgrade, backward, compatibility, deprecate

**Questions:**
- What existing data/code affected?
- Migration strategy?
- Rollback plan?
- Deprecation timeline?

**Ignore if:** Greenfield, new feature with no legacy

---

### Integration

**Signals:** third-party, external, API, sync, webhook, import, export, connect

**Questions:**
- What external systems involved?
- Data format requirements?
- Rate limits?
- Failure handling?

**Ignore if:** Self-contained feature, no external deps

---

### Deployment

**Signals:** release, deploy, rollback, feature flag, canary, blue-green, CD

**Questions:**
- Feature flag needed?
- Rollback strategy?
- Staged rollout?
- Environment-specific config?

**Ignore if:** Local development, internal tool

---

### Observability

**Signals:** log, metric, trace, monitor, alert, dashboard, debug, audit

**Questions:**
- What to log?
- Key metrics to track?
- Alerting thresholds?
- Debug visibility?

**Ignore if:** Prototype, short-lived experiment

---

### Documentation

**Signals:** doc, readme, guide, reference, API docs, changelog, comment

**Questions:**
- User-facing docs needed?
- API reference updates?
- Architecture decision record?
- Changelog entry?

**Ignore if:** Internal refactor, no behavior change

---

## Aspect Selection Rules

1. **Minimum:** At least 2 aspects for any non-trivial task
2. **Maximum:** Cap at 5 aspects to avoid over-engineering
3. **Dependencies:** If Data selected, likely need Testing
4. **Mandatory pairs:**
   - Auth → Testing (security tests required)
   - API → Documentation (contract must be documented)
   - Migration → Deployment (rollback plan required)

## Output

List relevant aspects with evidence:

```markdown
### Relevant Aspects

1. **Data** — "persist user preferences" in spec
2. **API** — "expose endpoint for settings"
3. **Testing** — Required by Data (mandatory pair)
4. **Auth** — "only authenticated users" constraint
```
