# Conversational

A **move** evolves a thought in a conversation. It is a move here only if it is experienced as ping-pong

## The moves

|                 | Needs                                       | Gives                               | The agent is in the wrong one if                  |
| --------------- | ------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| **Explain**     | something settled the user doesn't hold     | it, usable, in the user's head      | the agent is the one learning → **Elicit**        |
| **Elicit**      | the user holds something they can't express | the user's situation, on the record | a plain question would have worked → **Clarify**  |
| **Clarify**     | words that admit two readings               | one confirmed ask                   | it keeps going past concrete → **Interrogate**    |
| **Interrogate** | a proposal the user already committed to    | decisions the user can defend       | it could finish with the user absent → not a move |

Those redirects form a total ordering — Explain → Elicit → Clarify → Interrogate — and the last one points out of the set rather than at another move.

## Not a move

**Interviewing** — a format. Contributes protocol only: one question at a time, and a stop condition. The moves borrow their stop from it.

## Settled

|                    |                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Premortem          | not a move — a step inside one, like AUDIT.                                                                                        |
| Elicit's mechanism | interactive over static. Something the user can react to and steer, not a question list — and not text-only, unexperienced choices |
