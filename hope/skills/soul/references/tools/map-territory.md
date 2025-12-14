# Map vs Territory

The map is not the territory. Models, abstractions, and representations are not the reality they describe.

---

## When to Use

- Debugging: Is the mental model accurate?
- Architecture: Do diagrams reflect actual system?
- Planning: Do estimates reflect actual work?
- Communication: Does the other person's model match yours?
- Any abstraction layer

---

## The Framework

### Core Insight

> "The map is not the territory it represents, but, if correct, it has a similar structure to the territory, which accounts for its usefulness."
> — Alfred Korzybski

Every representation loses information:

- Code comments describe code, not what code actually does
- Architecture diagrams show intended design, not deployed reality
- Documentation describes expected behavior, not actual behavior

### Questions to Ask

1. **What does this model include?** (What's on the map?)
2. **What does it exclude?** (What's off the edge?)
3. **How old is this model?** (Maps become outdated)
4. **Who made it and why?** (Maps reflect maker's purpose)
5. **Have I verified against reality?** (Check the territory)

---

## Code Examples

### Map (Documentation)

```python
# Returns user's full name
def get_name(user):
    return user.name
```

### Territory (Actual Behavior)

```python
def get_name(user):
    return user.name  # Returns None if user.name not set!
```

The map says "returns full name." The territory includes a None case.

---

## Common Map-Territory Confusions

| Map              | Territory           | Danger                  |
| ---------------- | ------------------- | ----------------------- |
| Type definitions | Runtime values      | Types can lie           |
| Test coverage %  | Actual test quality | Coverage ≠ correctness  |
| Estimates        | Actual time         | Off by 2-10x typically  |
| Metrics          | User experience     | Goodhart's Law          |
| Org chart        | How work flows      | Informal networks exist |

---

## Layers of Abstraction

```
Territory: Actual electrons in silicon
    ↑
Map 1: Machine code
    ↑
Map 2: Assembly
    ↑
Map 3: High-level language
    ↑
Map 4: Framework abstractions
    ↑
Map 5: Your mental model
```

Each layer is a map of the layer below. Bugs hide in the gaps.

---

## Anti-Patterns

- **Map worship**: Trusting documentation over observation
- **Map neglect**: Never documenting because "code is truth"
- **Map confusion**: Arguing about models instead of checking reality
- **Forgetting the map**: Treating abstractions as concrete

---

## Verification Protocol

When a map seems wrong:

1. Don't immediately blame the map
2. Check the territory (run the code, observe the system)
3. Update whichever is wrong (map or your understanding)

---

## Provenance

Alfred Korzybski, Polish-American philosopher, 1931. Foundation of general semantics. Related: "The menu is not the meal" (Alan Watts), "All models are wrong, but some are useful" (George Box).
