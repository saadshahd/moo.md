# Confidence Calibration

Rules for calculating and displaying simulation confidence.

---

## Base Score

Every expert simulation starts with a base score:

| Expert Type | Base |
|-------------|------|
| Curated profile exists | 6/10 |
| No profile (dynamic inference) | 4/10 |

---

## Modifiers

Apply modifiers based on context:

| Factor | Impact | Notes |
|--------|--------|-------|
| **Extensive prior work** (3+ books, 10+ talks) | +2 | Transcripts/text required |
| **Topic matches core domain** | +1 | Within their documented expertise |
| **Topic is adjacent to domain** | 0 | Related but not primary focus |
| **Topic outside documented expertise** | -2 | Speculating beyond their work |
| **Calibration corrections exist** | Variable | Apply per correction |
| **Recent public statements** (< 2 years) | +1 | Views may have evolved |

---

## Confidence Actions

| Confidence | Action |
|------------|--------|
| **< 3/10** | Refuse. "Insufficient data to simulate [Expert]." |
| **3-5/10** | Warn: "LOW CONFIDENCE — treat as directional only" |
| **6-7/10** | Standard simulation with confidence in header |
| **8-9/10** | High confidence (9/10 cap — never claim perfect simulation) |

---

## Display Format

Every counsel response includes:

```
**Channeling [Expert Name]** (X/10 confidence)

[Response in expert's voice]

---
*Simulated perspective based on [Expert]'s documented work. Use /counsel:calibrate if this doesn't sound right.*
```

---

## Calibration Impact

When a calibration correction exists for an expert:

1. Check `.claude/logs/counsel-calibrations.jsonl` for matches
2. For matching calibrations:
   - Avoid the "wrong" pattern
   - Lean toward the "correct" pattern
   - Note: "(adjusted per calibration)"
3. Do NOT change confidence score — calibrations refine direction, not certainty

---

## Multi-Expert Panels

For panels, show per-expert confidence:

```
**Panel:** Osmani (7/10), Hickey (8/10), Simpson (7/10)
```

Overall panel confidence = average, but highlight any expert below 5/10.
