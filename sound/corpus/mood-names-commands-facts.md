---
paths: "**/*.{ts,tsx}"
when: always
source: house
topic: naming
---
Name events and messages by grammatical mood. A command is a request that may be refused — name it imperative `VERB_NOUN` (`SUBMIT_ORDER`, `JOIN_ROOM`). A fact already happened and cannot be refused — name it past-participle `Noun-Verb` in PascalCase (`RoomJoined`, `PaymentCaptured`, `EventAdded`). Never a tense-neutral noun.
_Avoid_: tense-neutral message nouns (`OrderSubmission`, `RoomJoin`) that hide whether the thing is a request or a result.
Detect: an event/message tag that is neither an imperative `VERB_NOUN` nor a past-participle `Noun-Verb`; a nominalized `-tion`/`-ing` form standing in for a command or a fact.
Cross-ref: pure-decide-emits-facts — the command handler that turns moods into facts; command-vs-fact-when-reconciled-elsewhere — when the two moods must also be separate STATES.
