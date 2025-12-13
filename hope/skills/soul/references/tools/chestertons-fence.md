# Chesterton's Fence

Don't remove something until you understand why it was put there.

---

## When to Use

- Before refactoring "unnecessary" code
- Before removing "obsolete" processes
- Before changing conventions or traditions
- Before deleting configuration you don't understand
- Before "simplifying" complex logic

---

## The Framework

1. **Encounter** something that seems useless or outdated
2. **STOP**: Resist the urge to remove immediately
3. **Investigate**: Why was this created? What purpose did/does it serve?
4. **Document** your understanding
5. **Only then**: Decide whether to remove

### Questions to Ask

- What problem was this solving?
- Who added it and when?
- What breaks if I remove it?
- Is there a test that exercises this path?
- Have I checked production logs/metrics?

---

## The Parable

> "There exists a fence across a road. The more modern type of reformer goes gaily up to it and says, 'I don't see the use of this; let us clear it away.' To which the more intelligent type of reformer will do well to answer: 'If you don't see the use of it, I certainly won't let you clear it away. Go away and think.'"
> — G.K. Chesterton, *The Thing* (1929)

---

## Code Examples

### Bad

```python
# This looks useless, delete it
# time.sleep(0.1)  # Removed in cleanup
```

### Good

```python
# CHESTERTON: Added 2019 to prevent race condition
# with external payment processor callback.
# See incident #1234. Do not remove without
# verifying processor API timing guarantees.
time.sleep(0.1)
```

---

## Anti-Patterns

- **Analysis paralysis**: Spending forever investigating trivially removable code
- **Preserving everything**: The fence may no longer be needed; understanding is required, not preservation
- **Ignoring git blame**: The history often explains the fence

---

## Combination

Pairs well with:
- [Second-Order Thinking](second-order.md): What happens if we remove this?
- [Pre-Mortem](pre-mortem.md): Imagine removal has caused disaster

---

## Provenance

G.K. Chesterton, "The Thing" (1929). Popular with Wikipedia editors ("Don't remove a rule until you understand it") and software engineers. JFK reportedly kept this as a guiding principle.
