# CLAUDE.md (planted taste rubric)

> This is a COPY of the user's real global taste, planted as the project rubric the
> slop-judge discovers. It is the actual TASTE.md + the load-bearing CLAUDE.md principles —
> not a synthetic subset. The judge judges agent-written code against THIS.

## Principles (from the user's global CLAUDE.md)

## Principles

- **Musashi's razor** — Do nothing of no use. Deletion > refactoring > rebuilding. Never ship dead code, unused abstractions, or speculative complexity.
- **Library over custom** — A library is tested, documented, and decoupled. Custom code is none of those by default.
- **Atomic over gradual** — No v2 interfaces, no deprecation layers. When something changes, change it everywhere at once.
- **Stop when uncertain** — If you're making assumptions, extrapolating beyond what you've verified, or choosing between approaches with different tradeoffs — surface it. Show what you know, what you're assuming, and what you haven't checked.
- **Verify against reality** — Before starting, define the observer: what tool, process, or check will confirm the work matches intent. Work isn't done until that observer passes.
- **Fail loud** — Whatever you build, make failure visible. No silent swallowing — in code, in plans, in assumptions.
- **Caller-blind functions** — A function's name, signature, and behavior must make sense without knowing who calls it. If it only makes sense in one call site's context, it's either misnamed or shouldn't be a function.
- **Read before write** — Never assume the codebase doesn't already solve the problem. Search first. If you can't search, ask.
- **DRY is not optional** — A single duplicated concept (not just duplicated text) is a defect. The cost of extraction is always less than the cost of divergence.

## Output rules

- Hypothesis first, then output. Never show work without a stated intent.
- No open unknowns → summary only.
- Open unknowns or novel work → full diff with rationale.
- Lead with one recommendation. Show alternatives only when the tradeoffs are genuine and the choice depends on context you don't have.
- Flag when a choice favours AI ergonomics over human maintainability.
- Say "I don't know" when you don't. Guessing costs more than searching, reading, or asking.

## Working style

- Finish one task fully before starting the next.
- Size work to my evaluation capacity, not your generation speed.

## Taste



---

## Code Taste

Every rule carries a `when` — the context that activates it. Before applying these rules, classify the task and state it in one line:

  `taste: <rigor> · <kinds>`      e.g.  `taste: high-stakes · react, db`

**rigor** — the task's blast radius:

- `throwaway` — one-off / spike / scratch — relaxes rules marked **[std]**
- `standard` — real code that will be maintained — the default
- `high-stakes` — payments · auth · data-loss · migrations — adds rules marked **[hi]**

**kinds** — what the task touches (zero or more): **[react] [db] [distributed]**. A kind-marked rule applies ONLY when that kind is present.

State the line, then proceed. If the human corrects the classification, reclassify. **[always]** rules apply to every task; a section's tag is its default, and a bullet's own tag overrides it.

### Data flow · [always]

* Use chained methods (`filter`, `map`, `reduce`) or `pipe()` for data transformations. Never build up arrays with imperative loops and `push`.
* Construct data structures in single expressions. `new Map(items.map(x => [x.id, x]))` over a loop that calls `.set()`.
* Use object/Map lookups for static mappings. Never `switch` or `if/else` when the keys are known at compile time.
* Data flow must be readable from the call site. The reader should trace what happens to data without jumping into implementations.
* Lazy over eager. Don't compute, fetch, or transform until the value is needed. Eager evaluation hides cost and couples timing to structure.
* Explicit over implicit. If a value is derived, show the derivation. If a side effect happens, it's visible where it's triggered. No action-at-a-distance.
* **Rules-as-data over imperative conditionals.** Express validation and policy as typed records interpreted by ONE engine. Never scatter `if`-checks for a policy that has more than one rule. The policy must be inspectable as data, not reconstructed by reading code paths. ALWAYS look for the declarative alternative before writing a conditional chain.
  * WRONG: a function whose body is a wall of `if (order.total > limit) return reject(...)`.
  * RIGHT: `const rules = [{ when: 'total exceeds credit limit', reject: 'OVER_LIMIT' }, ...]` interpreted by one evaluator.
* Domain rule predicates MAY be written as readable natural-language string literals so the data file reads as domain documentation on its own, without opening the interpreter.

### Error handling — CRITICAL · [std]

Rigor rides the blast radius: a `throwaway` may let a failure throw; `high-stakes` **[hi]** enumerates every surfacing failure mode up front. The decision order itself is always the right shape:

Decision order — apply in sequence; reach the next step only when the current one can't remove the error:

1. **Define the error out of existence.** Redesign the operation so the failure case doesn't exist. (`unset` of a missing key is a no-op, not an error; an empty range returns `[]`, not a `RangeError`.)
2. **Mask it at the lowest layer that can recover.** If a failure is handled where it occurs, absorb it there and return a normal value — don't propagate. Aggregate many would-be errors into one boundary check rather than threading a Result through every signature.
3. **Only then, surface it as data.** For a failure the caller genuinely must branch on, return a `Result<T, E>` whose `E` names every surfacing failure mode. NEVER use try/catch. NEVER throw.

* Find or define once: `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`.
* A `Result` union is for errors that MUST reach the caller — not a reflex on every fallible call. If `E` lists a failure the caller can't act on, it should have been eliminated (1) or masked (2).
* WRONG (reflex): every parse/db/validate call returns a Result, errors threaded through every layer regardless of whether the caller can act.
* WRONG (hidden): `async function getUser(id: string): Promise<User>` — throws, hides the failure.
* RIGHT: `getUser` returns `Promise<Result<User, NotFound | DbError>>` because the caller must branch on those; the connection-retry failure beneath it is masked in the data layer and never appears in the signature.

### Absence and optionality · [always]

* Never use `null` — not in types, not as a value.
* Never write `undefined` as an explicit value or type union member (`T | undefined`). Use optional properties (`field?: T`) for structural optionality and optional chaining (`?.`) for access.
* Fallible operations return `Result<T, E>`, not `T | null` or `T | undefined`.
* Absence checks use truthiness only: `if (!x)` not `if (x === null)`, `if (x === undefined)`, or `if (x == null)`.

### Type modeling · [always]

* Model domain states as discriminated unions with a `status` or `type` tag. Never use a flat type with optional fields to represent distinct states.
* Define types first when designing a feature.
* **Composition by base-spread.** When 2+ shaped values share a non-trivial core, define the core ONCE and build each variant by spreading it and adding only its delta; type as `Base & Delta`. NEVER copy shared fields across variant literals — copies drift.
  * WRONG: three object literals each restating the same six base fields.
  * RIGHT: `const base = {...}; const a = { ...base, kind: 'a', extra }; const b = { ...base, kind: 'b', other };`
* **State-modeling escalation.** Escalate beyond a plain union only under a named trigger: a guarded / asymmetric single-axis transition referenced from many call sites → an explicit `state -> event -> nextState` transition map (an illegal transition is a no-op, NOT a throw); 2+ INDEPENDENT concurrent axes with illegal combinations → orthogonal-region machinery. Absent the trigger, the union is the resting state. (See "Reaching for runtime machinery".)

### Function design · [always]

* Functions with 3+ parameters take a single object parameter. Group related primitives into named domain concepts.
* Extract complex predicates (2+ conditions) into named functions. Name reveals intent (`isEligible`), not implementation (`hasActiveStatusAndVerifiedEmail`).
* Pure functions are deterministic. No hidden dependencies on external state, time, or randomness. If a function needs the current time, take it as a parameter.

### Architecture · [always]

* Side effects live at the edges and are visible at the call site. No decorators, no implicit middleware, no silent mutations.
* If a function logs, that's a side effect — it belongs to the caller, not the function. Pure business logic functions NEVER call a logger internally.
* **[db]** Push filtering, sorting, and pagination to the database. Never fetch all rows and filter in application memory.
* **Dependency-at-the-edges.** Every source of impurity — nondeterminism (clock / random / id / network), storage, config, env, stateful singletons — has exactly ONE owning module behind a typed surface, wired once at the composition root. Call sites NEVER inline `new Date()`, `Date.now()`, `Math.random()`, `localStorage`, or `process.env`. No ambient globals.
  * WRONG: `const id = Math.random().toString()` mid-business-logic.
  * RIGHT: `Clock.now()` / `Ids.next()` injected from the root.
* **[distributed] Cross-boundary facts are queryable, not memorized.** When state spans processes, services, or third parties, make it observable at runtime — tracing, or structured logs at the boundary — so it can be re-derived on demand. NEVER depend on holding distributed state in your head, or in a static note that goes stale the moment the system moves.

### Naming · [always]

> Names are the documentation and the storytelling method. A name carries temporality (now vs then), role, and intent — consistently. If the name has to be explained, it is the wrong name.

* A function's name describes what it DOES, not where it's USED, and makes sense without knowing the caller — if removing the call site makes the name nonsensical, it's wrong. `save` not `handleProfileSaveClick`; `formatCurrency` not `formatPriceForCartItem`.
* Shorter is better until ambiguous. `parse` > `parseInput` > `parseUserFormInput`. Stop at the first name that's unambiguous in its module scope.
* No verb-stacking. One verb per function name. `validateAndSave` means two functions.
* Functions are bare verbs. The module IS the noun. `save`, `parse`, `validate` — not `saveInvoice`, `parseInvoice`.
* Export a single named object that matches the domain concept: `export const Invoice = { save, parse, validate } as const`. The author declares the namespace, not the caller.
* Call site reads as domain language: `Invoice.save(data)`, `Payment.parse(raw)`.
* **[react]** For React: compound components follow the same pattern. `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content`. The component group exports one noun, children are bare roles.
* NEVER repeat the domain noun inside function or component names. `InvoiceDialog.InvoiceContent` or `Payment.savePayment` means the noun is in the wrong place.
* **Name events and messages by grammatical mood.** A command is a request that may be refused — name it imperative `VERB_NOUN` (`SUBMIT_ORDER`, `JOIN_ROOM`). A fact already happened and cannot be refused — name it `Noun-Verb` past-participle in PascalCase (`RoomJoined`, `EventAdded`, `PaymentCaptured`). NEVER a tense-neutral noun (`OrderSubmission`, `RoomJoin`) — the mood is the meaning.
* **Boolean-returning names answer a yes/no question:** `is*` / `was*` / `should*` / `does*`. Now-vs-then pairs differ by tense only: `isX` = current state, `wasX` = prior state. BAN `validate` and `check` as predicate names — they hide the question the boolean answers.
* **A draft / in-flight entity gets its own domain noun** (`draftOrder`, `beingMadeMove`), never the committed type plus an `isEditing` flag. An entity mid-mutation is a distinct state, not a decorated copy of the committed one.
* **Actions that recompute derived state do NOT share the `set*` prefix with direct writes.** Name them by the computation: `computeTotals`, `deriveLineups` — never `setComputedTotals`. `set*` means a caller-supplied write; recomputation is a different act.
* **Suffixes live in the holder hierarchy (folder / module), never the variable name.** For pure declarative records, `variableName === identityField === filename`, with NO role suffix — no `Config`, `Schema`, `Def`, `Spec` tacked on. The folder declares the role; the file repeating it is noise.
* **When two imported namespaces share a name, alias at the import site to encode origin:** `import { Map as RxMap } from 'rxjs'`. NEVER shadow a name or rely on import order to disambiguate — the reader must see the origin at the use site.

### Placement and duplication · [always]

* Before creating any function, type, or constant: SEARCH the codebase for existing equivalents. If something does 80% of what you need, extend it — don't duplicate it.
* A single duplicated line is a bug if the duplication represents a shared concept. Extract it.
* Place code where it would be FOUND by someone who doesn't know it exists. That means: next to the domain concept it serves, not next to the feature that first needed it.
* If a computation or expression is used by 2+ domains, move it to the nearest common ancestor domain — the higher-level boundary that both consumers already belong to. Never to a grab-bag like `shared/`, `utils/`, or `helpers/`.
* Module names describe a domain concept, never a code-organization role. `formatting`, `currency`, `validation` — fine. `shared`, `utils`, `helpers`, `common`, `lib` — disallowed.
* Colocate by domain: everything for one bounded context lives together, and a module exposes only what its consumers need.

### Comments · [always]

* Inline comments are a smell. If a line needs explanation, the code is wrong — rename, extract, or restructure until it doesn't.
* Block comments are acceptable ONLY when the code cannot be made self-describing: regulatory constraints, non-obvious performance decisions, workarounds for external bugs. The comment explains WHY, never WHAT.
* The SOLE sanctioned inline comment is a single Hindley-Milner type-signature over an argument-free point-free binding: `// parse :: string => Result<Order, ParseError>`. It documents SHAPE only — never narrates steps.
* A `//` comment is acceptable only when omitting it would let a future editor silently break a non-obvious constraint. It MUST name a consequence (`// removing this breaks the calibration cache`) or an external-system mapping. A comment that paraphrases the line it sits on must be deleted.

### Components · [react]

* NEVER add `loading?: boolean`, `disabled?: boolean`, `fullWidth?: boolean`, or any behavioral boolean prop to a component's props type. Not even one. These are composition concerns, not props.
* When a prompt asks for "loading support," implement it as a SEPARATE wrapper component — never as a prop on the base component.
* Pattern for loading: create a `LoadingButton` component that wraps `Button`, sets `disabled`, and injects a spinner via the `icon` slot. The `Button` itself has NO loading prop.
* Pattern for fullWidth: use a CSS class or a `<FullWidth>` layout wrapper. Never a prop.
* Use `children` and slots (React.ReactNode) for composition.
* Discriminated unions for domain-model props, not for component variant props where the narrowing tax exceeds the benefit.

### Hooks · [react]

* Raw `useEffect` and `useRef` in components are low-level plumbing. They almost always represent a higher declarative concept — a subscription, a debounce, a media query, a previous value, an intersection observer.
* Extract these into named hooks that describe the INTENT: `useMediaQuery`, `usePrevious`, `useOnClickOutside`. The component reads like a description of behavior, not an implementation of it.
* A component with 2+ useEffects is a code review blocker. Each effect is either a custom hook waiting to be named, or a sign the component has too many responsibilities.

### Reaching for runtime machinery · [always]

> **Meta-principle:** Lean on the type system everywhere; pay for stateful machinery only where the state genuinely demands it.
>
> Structural / compile-time discipline is UNIVERSAL — apply by default, and it already lives in the tactical sections above: discriminated unions (Type modeling), base-spread composition (Type modeling), dependency-at-the-edges (Architecture). These cost nothing at runtime and are always on.
>
> This section governs only the RUNTIME orchestration machinery you must JUSTIFY: data-as-spec interpreters, command/fact temporal models, actor/message isolation, pure-update dataflow. Reaching for one of these without its trigger is over-engineering; name the trigger or don't reach.

**RESERVED — must earn its weight against the named trigger.**

* **Data-as-spec.** Reach for an inert tagged corpus + one member-blind interpreter ONLY when the member set BOTH grows over time AND members carry behavior — otherwise NEVER. MUST model it as a discriminated union paired with a `Record` keyed by the tag, so a missing member is a COMPILE error. NEVER build an interpreter for a closed / low-variance choice — use variant props or a typed map.
  * WRONG: a `switch`-driven interpreter over three fixed cases.
  * RIGHT: `type Member = { tag: 'a' } | { tag: 'b' }; const handlers: Record<Member['tag'], Handler> = { a, b }` — add a tag, the `Record` fails to compile until you supply it.
* **Command-vs-fact / temporal.** Separate intent from fact ONLY when the outcome is reconciled elsewhere (server / queue / peer) so intended and confirmed diverge in time — otherwise NEVER. MUST model `request -> pending -> (confirmed | rejected)` as discriminated states. NEVER collapse an unconfirmed intent and a confirmed fact into one mutable field. Locally-authoritative synchronous state stays a plain value — NEVER add pending machinery. _(The mood/tense naming — `VERB_NOUN` commands, PascalCase past-participle facts, `is`/`was` pairs — lives in the Naming section as the surface expression of this pattern.)_
  * WRONG: `order.confirmed = true` mutated in place over the intended value.
  * RIGHT: `type Order = { status: 'pending' } | { status: 'confirmed'; at } | { status: 'rejected'; reason }`.
* **Message-isolation (actor-ish).** Give a sub-flow its own reducer addressed only by typed messages ONLY when its lifecycle is independent of the parent — concurrent instances, survives a parent transition, or self-resets — otherwise NEVER. The parent MUST only SEND messages and READ a published view; it NEVER mutates child internals. A mode the parent merely steps through over shared data stays nested state — NEVER an actor.

**CONDITIONAL.**

* **Pure-update dataflow.** The INVARIANT is UNIVERSAL and always on: updates to a shared state tree MUST return a NEW tree, NEVER mutate in place; IO MUST be isolated at the edge (effects / streams), NEVER mixed into the update. The named-optic / lens MECHANISM is PROJECT-IDIOM-GATED: where optics are already the house style, MUST reach for a named optic at nested or multi-field updates; where they are not idiomatic, pure spread updates satisfy the invariant. NEVER impose optics unilaterally on a project that doesn't already use them.
