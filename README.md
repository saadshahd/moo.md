<img src="assets/cover-rounded.png" alt="moo.md - Stay present with AI" width="100%">

# hope @ moo.md

> "Ownership without comprehension is just a signature."
> from [The Engineer's Anxiety at the Penalty Kick](essays/the-engineers-anxiety/README.md)

Why introduce friction? Because **YOU** the human end up being the world model. The LLM powered agentic coder is just your hands with tiny muscle memory.

## The loop

Every piece of work starts as a raw **seed**, the rough thing you typed. **intent** turns the seed into a confirmed statement of what you actually want. **shape** turns that intent into a chosen approach before any code exists.

Every decision inside a stage is deliberately surfaced to you as a prompt with concrete options, a few at a time so you keep driving without getting overwhelmed. The model could fill these in on its own. It asks because the decision lands on you, and you need to know what you are carrying and living with.

```
you:  /hope:intent make the homepage better
moo:  Echo: "Rewrite homepage copy: value prop above the fold,
      signup in first viewport, targeting 5% conversion." Confirm?
moo:  Assumption. Signup fields: A) email-only, less friction
      B) email + company, better leads
you:  A
```

A raw seed, an echoed sentence, a tradeoff you chose on the record. That is the whole mechanism.

## Daily: /own

Agents grow the codebase faster than they grow your understanding of it, and the gap is the part you are accountable for. **own** is daily retrieval practice against that gap. It probes you on the concepts you shipped, spaced so questions arrive around the time you would forget them. A short conversation, four questions, no score.

## Try it

```bash
/plugin marketplace add saadshahd/moo.md
/plugin install hope@moo.md
```

Run the whole loop with `/hope:full <your seed>`, or stage by stage with `/hope:intent` and `/hope:shape`. Tomorrow, `/hope:own`.
