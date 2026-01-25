# Design Token Volatility

Commit cadences based on how often design decisions change. Distinguishes pattern from taste.

---

## Volatility Categories

| Category | Commit Cadence | Examples |
|----------|----------------|----------|
| **Low** | Commit and forget | Spacing scale, typography scale, grid system |
| **Medium** | Review quarterly | Colors, shadows, border radii |
| **High** | Trends shift | Gradients, effects, illustrations, decorative elements |

---

## Category Characteristics

### Low Volatility (Commit and Forget)

These are **pattern decisions** — structural choices that enable consistency:

- 4px/8px spacing scale
- Type scale ratios
- Grid columns and gutters
- Breakpoint definitions

**Why stable:** Changing these cascades through the entire system. Frequent changes = design debt.

### Medium Volatility (Quarterly Review)

These are **brand decisions** — reflecting identity, not structure:

- Primary/secondary colors
- Shadow depth and spread
- Border treatments
- Default corner radii

**Why quarterly:** Brand evolution happens slowly. More frequent changes signal indecision, not iteration.

### High Volatility (Trend-Dependent)

These are **taste decisions** — reflecting current aesthetics:

- Gradient styles
- Decorative effects (blur, glow, noise)
- Illustration style
- Micro-animation flourishes

**Why volatile:** Trends shift. These tokens should be isolated so updates don't cascade.

---

## Pattern vs Taste

| Aspect | Pattern | Taste |
|--------|---------|-------|
| Changes break things | Yes | No |
| Requires system update | Yes | No |
| Reflects trends | No | Yes |
| Decision reversibility | Low | High |

**Rule:** Pattern decisions get one chance. Taste decisions can iterate.

---

## Commit Recommendations

### Before Committing Low-Volatility Tokens

- [ ] Test at multiple scales
- [ ] Verify accessibility (spacing, type size)
- [ ] Document the rationale
- [ ] Assume this won't change for 2+ years

### Before Committing Medium-Volatility Tokens

- [ ] Align with brand guidelines
- [ ] Check contrast ratios
- [ ] Schedule quarterly review
- [ ] Document which components depend on these

### Before Committing High-Volatility Tokens

- [ ] Isolate from structural tokens
- [ ] Use semantic names that survive style changes
- [ ] Accept these will change
- [ ] Don't over-document — they're ephemeral

---

## Token Isolation Strategy

Structure tokens to contain volatility:

```
tokens/
├── foundation/        # Low volatility - spacing, scale, grid
├── brand/             # Medium volatility - colors, shadows
└── decorative/        # High volatility - effects, gradients
```

Changes to `decorative/` should never require changes to `foundation/`.

---

## Anti-Patterns

- **Coupling taste to pattern** — Gradient values baked into spacing tokens
- **Over-documenting ephemeral tokens** — Detailed rationale for a trend-driven gradient
- **Frequent foundation changes** — If you're changing spacing scale quarterly, you didn't commit correctly
- **Treating all tokens equally** — Different volatility = different governance
