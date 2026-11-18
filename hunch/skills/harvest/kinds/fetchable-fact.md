# Fetchable fact

A fact the user typed that the agent could have fetched itself.

**Sign:** a USER turn or an `[answer]` that gives a fact a tool call reaches: a path, a value, a command's output, a file's, page's or log's content.

| Counts | Doesn't |
|---|---|
| The user answers an `[ask]` with it, before or after `[work-start]` | What only the user holds: what they want, their reasons, taste or limits |
| The user types it after the agent guessed, stalled or went wrong without it | The user's first prompt, where they state the ask |
| A tool call in the session reads the same place, before or after | A fact behind a sign-in, payment or approval only the user can give |
| | A late `[ask]` whose answer undid work: that is a late ask |

**Evidence:** the turn that gives the fact, and the turn whose tool call reads where it lived, or the path, command or address the fact names.
