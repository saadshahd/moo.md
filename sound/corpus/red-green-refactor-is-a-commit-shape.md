---
paths: "**/*.{test,spec}.{ts,tsx}"
when: always
source: Beck
---
when: [always] · tier: standard · check: deterministic
TDD isn't a personal ritual you attest to — it leaves a fingerprint in the diff: the test file and the source file for one behavior change together, and the test asserts the new behavior, not just re-describes the new code.
WRONG:
```
commit A: "add discount tiers" (touches pricing.ts only)
commit B: "add tests" (touches pricing.test.ts only, 3 weeks later)
```
RIGHT:
```
commit: "add discount tiers"
  - pricing.ts: adds tier logic
  - pricing.test.ts: asserts $100+ order gets 10% off
```
_Avoid_: a production file changed in a commit with no corresponding test file changed in that same commit (for anything but a pure tidy — see tidy-or-behavior-never-both).
Detect: git diff stat per commit — does a behavior-changing commit touch a `*.ts` file without touching its paired `*.test.ts`/`*.spec.ts`.
Not-when: the change is to non-testable surface (types-only, config, markup-only tidy) or the repo has no test infra for that layer yet (greenfield — but then the FIRST behavior commit should establish the pairing).
