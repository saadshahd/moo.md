---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Hughes
topic: tests
---
Any pair of encode/decode, serialize/parse, or save/load functions must satisfy `decode(encode(x)) === x` for all generated `x`, not just the fixtures you happened to write.
_Avoid_: a fixed `sampleX`/`mockX` constant reused as the sole input to a roundtrip assertion.
Detect: a test named `*roundtrip*`, `*serializ*`, or `*parse*` whose only input is a hand-written literal, with no property runner over a generator in the file.
Not-when: the format is lossy by design (e.g. a display formatter that drops precision) — state the weaker invariant that survives instead (`parse(format(x))` within tolerance).
