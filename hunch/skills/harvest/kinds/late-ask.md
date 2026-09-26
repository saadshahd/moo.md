# Late ask

A question or foresight that belonged before work started.

**Sign:** an `[ask]` line, or a question in an AGENT turn, after the `[work-start]` line, whose answer undid or changed what the agent had built.

| Counts | Doesn't |
|---|---|
| The answer reverts or rewrites work after `[work-start]` | A question about something the work itself uncovered, that no one could know before |
| The answer was in the user's first prompt or reachable before the work | A question whose answer changed nothing built |
| The agent built on an assumption and later asked about it | A progress check the user asked for |

**Evidence:** the `[work-start]` turn, the late question's turn, the answer, and the turn where the work changed because of it.
