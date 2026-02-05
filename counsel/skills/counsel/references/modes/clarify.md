# Clarification Mode

Logic for `/counsel:panel clarify {dimension} for: {spec}` pattern.

---

## Process

```dot
digraph ClarifyMode {
  rankdir=TB
  node [shape=box, style="rounded,filled", fillcolor="#f5f5f5"]

  Start [label="clarify {dim} for: {spec}", fillcolor="#e6f3ff"]
  ParseDim [label="Parse dimension"]
  SelectExperts [label="Select 2 experts\nfrom dimension pool"]
  LoadProfiles [label="Load only 2 profiles\n(lazy)"]
  GenOptions [label="Generate concrete\nclarification options"]
  Format [label="Format with descriptors\n+ reasoning"]
  Done [label="Output + offer expand", fillcolor="#ccffcc"]

  Start -> ParseDim -> SelectExperts -> LoadProfiles -> GenOptions -> Format -> Done
}
```

---

## Dimension Pools

| Dimension | Expert Pool |
|-----------|-------------|
| Outcome | Jobs, Graham, Kay, Victor |
| Scope | Fowler, Hickey, Feathers, Alexander |
| Constraints | Pike, Osmani, Hightower, Gregg |
| Success | Norman, Majors, Zhuo, Beck |
| Done | Cagan, Humble, Newman |

**Extended aspects:**

| Aspect | Experts |
|--------|---------|
| Design | Norman, Zhuo, Frost, Alexander |
| UI | Abramov, Osmani, Perry, Wathan |
| UX | Norman, Zhuo, Victor, Case |
| Innovation | Jobs, Kay, Victor, Matuschak |

---

## Output Format

```
### Clarification Options: {Dimension}

**[Expert A descriptor] (X/10)** recommends:
"[Specific, measurable clarification]"
_Reasoning: [Why from their philosophy]_

**[Expert B descriptor] (Y/10)** recommends:
"[Alternative clarification]"
_Reasoning: [Why from their philosophy]_

---
*Want another perspective? Reply 'expand' to add 1-2 more experts.*
```

---

## Requirements

- Each option must be specific and measurable
- Include brief reasoning from expert's philosophy
- Generate descriptor per [confidence.md](../confidence.md#descriptor-generation)
- Load only selected profiles (lazy loading)
