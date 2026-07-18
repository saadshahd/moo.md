---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: naming
---
when: [always] · tier: standard · check: judgeable
Functions are bare verbs; the module is the noun. Export a single named object matching the domain concept so the call site reads as domain language. Never repeat the domain noun inside a member name, and never stack two verbs in one name — `validateAndSave` is two functions.
WRONG:
```ts
export function saveInvoice(i: Invoice) {}
export function parseInvoice(raw: string): Invoice {}
export function validateAndSaveInvoice(i: Invoice) {}
```
RIGHT:
```ts
export const Invoice = { save, parse, validate } as const;
// call site: Invoice.save(data), Invoice.parse(raw)
```
_Avoid_: `save<Noun>` / `<Noun>.save<Noun>` (noun in the wrong place), a verb-stacked name (`validateAndSave`), or loose top-level function exports where a domain object should own them. For React, compound components follow the same shape — `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content`: the group exports one noun, children are bare roles.
Detect: a function name that contains the module's own noun; an exported verb-function not gathered under a domain object; an `And`/`Then` joining two verbs in one name.
Not-when: a top-level module already IS the noun via its filename and exports bare verbs directly — no wrapping object needed if the module boundary supplies the noun.
