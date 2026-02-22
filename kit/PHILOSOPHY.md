# kit — Philosophy

Tactical tooling for AI work. Capability amplifiers that make Claude faster, more informed, more capable. Where hope shapes thinking, kit shapes doing.

---

## Beliefs

### 1. Tools should be invisible

Good tooling disappears into the workflow. If using a tool requires learning a process, the tool failed. Friction in tooling is pure waste — unlike friction in thinking, which can teach. The best tool is one you forget you're using.

### 2. Capability should be composable

Tools that work only in prescribed combinations are brittle. Each tool must be independently useful AND combine freely with others. No tool should assume what comes before or after it. Composition emerges from good interfaces, not orchestration layers.

### 3. AI-native over human-adapted

Tools designed for human hands don't fit AI well. Screen readers, mouse simulation, and manual config are adapters, not solutions. Design for how AI actually interacts: structured I/O, programmatic access, deterministic state. Human-readable is a nice-to-have, not a requirement.

### 4. Speed with awareness

Fast execution is the point of tooling. But speed without feedback is blind velocity. Every tool must report what it did, what changed, and what it couldn't verify. Silent success is indistinguishable from silent failure.

### 5. Environment is infrastructure

Flaky environments waste more time than bad code. Stable, reproducible, predictable environments are not a luxury — they are the foundation tools build on. A tool that works "most of the time" doesn't work.

---

## Principles

- **Invisible over ceremonial** — No setup steps, no configuration wizards, no "getting started" rituals. Work on first use.
- **Structured I/O over screen parsing** — Prefer APIs, DOM access, programmatic interfaces over visual scraping.
- **Deterministic over probabilistic** — Same input, same output. When that's impossible, report the variance.
- **Fail loud, recover quiet** — Errors must be visible and specific. Recovery should be automatic when possible.
- **Stateless between invocations** — Each tool use starts clean. No hidden state from previous runs.
- **Composable over comprehensive** — Small tools that combine beat large tools that do everything.

---

## Hard Constraints — "Never Do"

1. **No process ceremony** — Kit tools must not introduce workflow steps. A tool that requires a ritual before use has already failed.
2. **No hope dependency** — Kit works without hope installed. No hard references, no shared state, no assumed pipeline.
3. **No human-only interfaces** — Every tool must be AI-invocable. If it requires a GUI, a mouse, or manual input, it doesn't belong.
4. **No silent failures** — Every tool reports success or failure explicitly. Silent errors compound into hours of debugging the wrong thing.
5. **No environment assumptions** — Tools declare and verify their requirements. "Works on my machine" is not shipping.

---

## Philosophy Audit (Before Committing Changes to kit)

- [ ] Does this add ceremony? → Tools should be invisible
- [ ] Does this require other kit tools to function? → Composable, not coupled
- [ ] Does this parse screens when an API exists? → Structured I/O over parsing
- [ ] Does this fail silently? → Fail loud
- [ ] Does this assume environment state? → Declare requirements
- [ ] Does this serve at least one aim (regret reduction / clarity / fewer artifacts / ownership)? → Trace to mission outcomes
- [ ] Does this build something Claude will do natively? → Don't compete with platform
- [ ] Does this create persistent state? → Stateless between invocations
