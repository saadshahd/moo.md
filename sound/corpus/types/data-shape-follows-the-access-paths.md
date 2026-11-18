Settle the core types and data structures before the logic over them, each shaped to the access paths traced through it: a lookup by key gets a map keyed by it, an ordered read an ordered structure, a value read together a single record.
_Avoid_: a linear search by the same key repeated across call sites; parallel arrays indexed together; a type reshaped in each commit that adds logic over it.
Detect: a collection searched by one key (`.find(x => x.id === id)`, `.filter(...)[0]`) at 2+ sites or inside a loop, where a map keyed by it fits; a type whose fields change in most of the commits that change the logic using it.
Not-when: a collection small and fixed enough that the access shape cannot matter (a handful of config entries); a spike whose shape is the thing being found.
Cross-ref: red-green-refactor-is-a-commit-shape — shared types land before the first behavior commit; discriminated-union-over-flag-bag — the shape for a value that is one of several cases.
