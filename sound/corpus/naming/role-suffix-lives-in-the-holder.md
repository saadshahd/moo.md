Role suffixes live in the holder hierarchy — the folder or module — never the variable name. For a pure declarative record, `variableName === identityField === filename`, with no role suffix that merely restates the role its folder already declares.
_Avoid_: a declarative record's variable or filename ending in `Config`/`Schema`/`Def`/`Spec` when the containing folder already names that role.
Detect: an exported const whose name ends in a role suffix that duplicates its folder's role; a filename and identifier that disagree, or that carry a suffix the directory already supplies.
Not-when: the suffix distinguishes two genuinely different holders in the same scope (a `Schema` next to the `Type` it validates), not just decorating the role the folder already declares.
