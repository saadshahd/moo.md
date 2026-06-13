<img src="assets/cover-rounded.png" alt="moo.md - Stay present with AI" width="100%">

# hope @ moo.md

Why introduce friction? Because **YOU** the human end up being the world model. The agent is just your hands with tiny muscle memory.

moo does not build. It does not author your code, rules, or taste. It works alongside build tooling like [superpowers](https://github.com/obra/superpowers). You hand-write your own rules — your `CLAUDE.md`, your taste. moo keeps you owning what matters and gets out of the way.

One idea runs through all three layers: **never delegate a decision.**

## Try it

```bash
/plugin marketplace add saadshahd/moo.md
/plugin install hope@moo.md
```

Run the whole loop with `/hope:full <your seed>`, or stage by stage with `/hope:intent` and `/hope:shape`. On Monday, `/hope:own`.

## A loop

The loop is pure decision work. You drive it slowly, in your own context.

Every piece of work starts as a raw **seed**, the rough thing you typed. It is the one artifact that is fully yours.

**intent** and **shape** do not make the seed more honest. They make it explicit and specified. Each surfaces a decision as an interactive question, every choice previewed, a few at a time, and you answer. Every added detail stays yours because you chose it. intent turns the seed into a confirmed statement of what you want. shape turns that into a chosen approach before any code exists.

The result is a card that hands off outside your context window.

![The loop](assets/loop.png)

## A mode

**delegate** is the line between deciding and doing.

You keep every decision. Each one is surfaced to you so you stay engaged. Only tactical, observable work fans out to agents: implement, test, verify, audit, explore.

This is also what stops compaction from silently rewriting your context. The verbose doing never enters your main thread, so it can never quietly mutate what you decided.

![Deciding stays, doing leaves](assets/delegate.png)

## A routine

**own** is retrieval practice. It runs on Monday, spaced, so questions arrive around the time you would forget.

Agents grow the codebase faster than they grow your understanding of it. That gap is the part you are accountable for. own closes it. It probes you on the concepts you shipped. A short conversation, four questions, no score.

What the agent never carries between sessions is what own trains. The problem is named in [One Flew Over the Context Window](https://saadshahd.github.io/blog/one-flew-over-the-context-window/).

![own](assets/own.png)

## What each layer guards

| What erodes ownership              | Layer          | Guard                              |
| ---------------------------------- | -------------- | ---------------------------------- |
| AI fills in your decisions         | /intent & /shape | interactive questions, each choice previewed |
| compaction mutates & drifts your context | delegate  | doing stays out, deciding stays in |
| code grows faster than understanding | own          | spaced recall keeps understanding current |

## Reading

- [The Engineer's Anxiety at the Penalty Kick](https://saadshahd.github.io/blog/the-engineers-anxiety-at-the-penalty-kick/) — "Ownership without comprehension is just a signature."
- [One Flew Over the Context Window](https://saadshahd.github.io/blog/one-flew-over-the-context-window/) — what the agent never carries between sessions.
