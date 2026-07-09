---
paths: "**/*.{ts,tsx}"
when: always
source: house
---
when: [always] · tier: standard · check: deterministic
When two imported namespaces share a name, alias at the import site to encode origin. Never shadow a name or rely on import order to disambiguate — the reader must see the origin at the use site.
WRONG:
```ts
import { Map } from 'rxjs';
import { Map } from 'immutable'; // collision — order decides which wins
```
RIGHT:
```ts
import { Map as RxMap } from 'rxjs';
import { Map as ImmutableMap } from 'immutable';
```
_Avoid_: two imports of the same identifier without aliasing; an alias that hides origin rather than naming it.
Detect: a file importing the same name from two modules; a local binding that shadows an imported name of the same identifier.
Not-when: the name appears once — no collision, no alias needed.
