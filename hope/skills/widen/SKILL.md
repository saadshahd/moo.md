---
name: widen
description: Assemble cases from context, induce the widest sound rule. Use when a real case shows a class no rule yet decides, or a rule decides only the cases it came from.
---

## Assemble

This runs inside one turn — nothing waits on the user.

Pull every real case the context holds — what the input shows, what the named files record, what memory and your own judgment place in the same class. State each case with the wrong answer it exhibits and the right answer it demands.

## Induce

Do not summarize the cases. Induce the widest rule that gets every case in the set exactly right, and forbids the wrong answer each case exhibits.

Where a rule already existed, the new one still comes from the case set alone; if the cases or the objective moved, the old rule is void and what you hand back is a fresh derivation. Between candidate rules, prefer the one that decides more situations, even if it takes longer to state.

## Probe

1. List 10 situations not in the case set where the rule gives a definite answer, and state the answer it forces in each.
2. Hunt for one situation where the rule forces a wrong answer.
   - Found one → narrow the rule by the smallest amount that fixes it. A narrowing that loses a case from the set went past the smallest — find one that keeps the whole set. Then list and hunt again on the narrowed rule.
   - Found none → the loop ends; the rule stands.

If narrowing has left the rule unable to give a definite answer in 10 situations outside the set, stop there and carry the shortfall into the record — the widest sound rule found barely outreaches its cases.

## Hand back

Three things: the case set, one case per line; the rule; and the record — one line per situation listed with the answer the rule forces, one line per narrowing with the situation that forced it. The rule is claimed right on the set and the listed situations, checked; everything wider stays open.

Nothing unseen will ever meet the rule — something already written should get shorter and nothing it covers can be lost → use **reduce** skill.
