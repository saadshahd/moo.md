---
when: db
source: house
topic: consistency
---
Push filtering, sorting, and pagination to the database. Never fetch all rows and filter, sort, or slice in application memory. This is correctness, not optimization: an in-memory `slice` reports a page count and cursor that don't match what the store actually holds.
_Avoid_: fetching an unbounded result set then `.filter`/`.sort`/`.slice` in JS; counting or paginating over an array the app materialized in full.
Detect: a query with no `where`/`order`/`limit` whose result is immediately filtered, sorted, or sliced in application code.
Not-when: the full set is intentionally small and bounded by the schema (a fixed lookup table), or the filter genuinely cannot be expressed in the query language.
