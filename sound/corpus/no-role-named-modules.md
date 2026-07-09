---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: deterministic
Module and directory names describe a domain concept, never a code-organization role. `formatting`, `currency`, `validation` are fine — they name what the code is about. `shared`, `utils`, `helpers`, `common`, `lib` are disallowed — they name where the author filed it, so nobody can predict what's inside or where a new thing should go.
WRONG:
```ts
import { formatMoney } from '@/utils/format';
import { isEligible } from '@/shared/helpers';
```
RIGHT:
```ts
import { Currency } from '@/currency';
import { Eligibility } from '@/eligibility';
```
_Avoid_: any directory or barrel named `shared/`, `utils/`, `helpers/`, `common/`, or `lib/`; a grab-bag module that accretes unrelated functions because it had no domain to belong to.
Detect: grep the tree for path segments `shared`, `utils`, `helpers`, `common`, `lib` — each is a role-named holder that should be renamed to the domain it actually serves, or split across the domains its contents belong to.
Not-when: a genuinely cross-cutting library boundary published as its own package with a real domain identity — the ban is on grab-bag catch-alls, not on every folder that happens to be shared.
