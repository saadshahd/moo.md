---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Beck
topic: commit-shape
---
when: [always] · tier: standard · check: deterministic
TDD isn't a personal ritual you attest to — it leaves a fingerprint in the diff: the test written first (so its shape pressures the interface — a function awkward to call from a test will be awkward to call from production), the test file and the source file for one behavior change landing together, and the test asserting the new behavior, not just re-describing the new code.
WRONG:
```
commit A: "add discount tiers" (touches pricing.ts only)
commit B: "add tests" (touches pricing.test.ts only, 3 weeks later)
// or: implementation shipped first, its test written after — contorting itself around an
// awkward 6-argument signature the test never got to pressure
```
RIGHT:
```
commit: "add discount tiers"
  - pricing.test.ts: asserts $100+ order gets 10% off   (written first, shapes the signature)
  - pricing.ts: adds tier logic
```
_Avoid_: a production file changed in a commit with no corresponding test file changed in that same commit (for anything but a pure tidy — see tidy-or-behavior-never-both); a signature with 5+ constructor params or config objects invented after the fact to patch a bad shape the test never pressured.
Detect: git diff stat per commit — does a behavior-changing commit touch a `*.ts` file without touching its paired `*.test.ts`/`*.spec.ts`; and does the test assert the new behavior rather than mirror the new code.
Not-when: the change is non-testable surface (types-only, config, markup-only tidy); throwaway/spike code nobody will call twice (skip TDD, don't retrofit tests onto a script you're about to delete); or the repo has no test infra for that layer yet (greenfield — but then the FIRST behavior commit should establish the pairing).
