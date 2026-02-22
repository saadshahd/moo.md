---
name: debug
description: Structured web app debugging with dev3000 (d3k). Use when debugging web apps, reading error context, capturing browser + server logs, or needing full debugging timeline. Triggers on "debug", "d3k", "dev3000", "what went wrong", "error context", "capture logs".
---

# Structured Debugging

CAPTURE THEN DIAGNOSE. Never guess at the cause — capture the full timeline first, then read it. d3k unifies server, browser, and network events into one log that makes root causes visible.

## Rules

- Never diagnose without context — always `d3k errors -c` before forming a hypothesis
- Let d3k own the dev server — don't run your server separately, d3k wraps it
- Read the timeline, don't grep for errors — surrounding events reveal the chain of causation
- Classify errors before fixing — the source tag determines where to investigate
- Always reproduce before fixing — d3k captures the reproduction automatically

## When to Use

| Situation | Approach |
|-----------|----------|
| Web app throws error | Start d3k, reproduce, read timeline |
| "It's broken but I don't know why" | `d3k errors -c` for context around failures |
| Need to understand a user flow | `d3k crawl` to map page interactions |
| CI test fails but works locally | `d3k --headless` to capture in CI-like environment |
| React component mystery | `d3k find-component <selector>` to trace to source |
| Need full-stack visibility during dev | Monitored development flow |

## Flow: Debug Cycle

The core loop — capture everything, classify, fix, verify.

```
d3k <framework-cmd>
→ reproduce the issue (d3k captures everything)
→ d3k errors -c (errors with surrounding interaction context)
→ classify by source tag
→ fix based on classification
→ reproduce again → d3k errors shows clean
```

Start d3k with your framework command directly:
```bash
d3k next dev        # Next.js
d3k vite            # Vite
d3k rails server    # Rails
```

d3k auto-detects the framework, opens monitored Chrome via CDP, and captures server + browser + network events to `~/.d3k/{project}/d3k.log`.

## Flow: Error Classification

The source tag in `d3k errors -c` output tells you where to look:

| Tag | Means | Investigate |
|-----|-------|-------------|
| `[SERVER]` | Backend crash/exception | Server code, dependencies, env vars |
| `[CONSOLE ERROR]` | Frontend JS error | Component code, state, props |
| `[NETWORK]` 4xx | Client request issue | URL, auth headers, request payload |
| `[NETWORK]` 5xx | Server handling issue | API route handler, DB queries, external services |
| `[RUNTIME.ERROR]` | Unhandled rejection/exception | Async code, missing error boundaries |

Read the events *before* the error — they reveal the chain:
```
[INTERACTION] Click on button#submit
[NETWORK] POST /api/users → 500 (12ms)
[CONSOLE ERROR] TypeError: Cannot read property 'id' of undefined
```

The interaction triggered the request, the request failed, the frontend crashed on the missing response. Fix the API route, not the frontend.

## Flow: Monitored Development

Start d3k from the beginning, not after something breaks. Proactive, not reactive.

```
d3k <cmd> → develop normally
→ d3k logs -t browser (check for warnings periodically)
→ d3k errors before commit (catch anything captured during dev)
→ fix any issues → clean commit
```

Filter logs by source when needed:
- `d3k logs -t browser` — browser events only
- `d3k logs -t server` — server output only
- `d3k logs -t network` — network requests only

## Flow: Browser Interaction via d3k

d3k bundles agent-browser — interact with the monitored app while d3k captures the full timeline.

```bash
d3k agent-browser --cdp $(d3k cdp-port) snapshot -i
d3k agent-browser --cdp $(d3k cdp-port) click @e3
d3k agent-browser --cdp $(d3k cdp-port) screenshot /tmp/shot.png
```

Every interaction appears in the d3k timeline alongside its server/network effects — full cause-and-effect visibility.

## Flow: AI-Assisted Diagnosis

When the timeline is complex, let d3k synthesize:

```bash
d3k fix              # Diagnose from all captured context
d3k fix -f build     # Focus on build errors specifically
d3k fix -t 5         # Analyze last 5 minutes only
```

Requires an active d3k session with captured data.

## Composition

- **With browser:** d3k monitors the full stack while agent-browser automates interactions — `d3k agent-browser --cdp $(d3k cdp-port)` bridges them
- **With portless:** `portless myapp d3k next dev` for monitored development with stable URLs
- **With hope:loop:** `d3k errors -c` output as debugging evidence when waves encounter failures
- **With hope:verify:** d3k screenshot captures as visual regression evidence in pre-PR checks

## Anti-Patterns

- **Diagnosing without capturing** — guessing at causes without reading the timeline
- **Running dev server separately from d3k** — d3k needs to own the process to capture everything
- **Grepping logs for error strings** — misses the surrounding context that reveals causation
- **Fixing the symptom** — a frontend crash from a failed API call means fixing the backend, not adding null checks
- **Ignoring warnings during development** — `d3k logs -t browser` catches issues before they become errors
