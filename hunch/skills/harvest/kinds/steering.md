# Steering

The user corrected, redirected or re-explained what the agent was doing.

**Sign:** a USER turn after an AGENT turn that says the agent had it wrong: "no", "not that", "I meant", "again", a repeat of an earlier ask in new words, or a stop.

| Counts | Doesn't |
|---|---|
| The agent's reply shows it had misread the ask, the scope or a rule | A new ask the earlier turns never touched |
| The user re-explains something the session already said | An answer to an `[ask]` the agent put |
| The user stops work the agent chose on its own | A change of mind the user states as theirs ("actually, let's also…") |

**Evidence:** the AGENT turn that went wrong and the USER turn that corrected it, both by number, and what the agent did next.
