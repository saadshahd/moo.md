A diff only counts as simpler if the number of concepts a reader must hold at once drops; "fewer lines" and "fewer artifacts" are not the metric.
_Avoid_: PR descriptions that say "simplified" or "inlined" where the diff stat is the only evidence offered.
Detect: a helper with a domain name gets inlined into its single call site — line count falls, concept count is unchanged (the four conditions still have to be held, just without a name to hold them by).
Not-when: the helper's name lied about what it did (name drift) — deleting a wrong name is a net concept decrease, not a violation.
