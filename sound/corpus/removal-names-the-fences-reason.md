---
paths: "**/*.{ts,tsx}"
when: always
source: grug + Chesterton
---
when: [always] · tier: standard · check: judgeable
Working code whose purpose is not obvious — a sleep, a retry, a re-check, a special case — is load-bearing until shown otherwise. A diff that deletes or bypasses such an oddity must name the reason it existed (recovered from blame, tests, or its author) and why that reason no longer holds — or state that the reason was searched for and not found.
WRONG:
```ts
// commit: "remove pointless sleep"
- await sleep(150);
  await confirmOrder(id);
```
RIGHT:
```ts
// commit: "remove read-after-write fence for provider replication lag —
// added in #812 for the v1 API; v2 (2025-03 changelog) reads its own writes"
- await sleep(150);
  await confirmOrder(id);
```
_Avoid_: commit or PR prose like "removed unnecessary/legacy/pointless X" with no record of what X was for; deleting a guard because no test fails — absence of a test is not absence of a purpose.
Detect: a diff removing or short-circuiting a delay, retry, guard, or special case where neither the diff, its comments, nor its description says what the removed code was protecting against.
Not-when: the code is provably dead (unreachable, flag retired, sole caller gone) — that is deletion-test territory, no archaeology owed; or the oddity was introduced within the same change-set being written.
Cross-ref: deletion-test-before-any-abstraction-ships — the opposite blade: that ladder licenses removing the unused; this rule gates removing the used-but-unexplained. comment-must-name-a-consequence — the comment that, had it existed, would make this rule instant to satisfy.
