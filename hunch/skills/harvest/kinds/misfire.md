# Misfire

The user named a moo skill or route, and the move it names did not happen.

**Sign:** a USER turn that names a moo skill (`/hope:intent`, "intent", "/shape", "consult a panel") with no `[skill]` line for it in the AGENT turn after, or a `[skill]` line whose turn does not do what the skill's body asks.

| Counts | Doesn't |
|---|---|
| Named, and no `[skill]` line follows | The user named it only to discuss it |
| The skill ran, and its turn skips the skill's own gate or output | The skill ran and its result was one the user disliked (that is steering) |
| A composer's plan names a skill that never ran | The user later cancelled the plan |

**Evidence:** the USER turn that names it, the AGENT turn where the move should be, and what that turn did instead.
