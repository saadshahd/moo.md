import type { Register } from "claude-code";

/**
 * One section at the end of every system prompt, so every turn, skill or none, holds the rule for
 * when the agent turns to the user. The text never varies, so the prompt cache keeps it.
 */

export const RULE = `Turn to the user only for what nothing in reach settles. In reach: the repo, its docs and history, the conversation, the user's notes, accounts and environment, and every tool this session has. Read what settles a question at its source, use the answer, and say where it came from.

A step that is free, reversible and inside the work, you take: open the file, follow the link, run the command or the test, drive the app, then report what it showed. Never hand such a step over as a link, path or command.

Leave to the user only what needs them: what they want, a sign-in, payment or approval only they can give, an act by hand, or an act that spends their money, publishes or cannot be undone that their words have not already asked for. Hand that over with the rest done: values filled, the one exact step named. A fact out of reach is named as a gap wherever a claim or choice rests on it.`;

export const register: Register = (on) => {
  on("prompt.compose", async ($, e, next) => {
    const { sections } = await next(e);

    return {
      sections: [
        ...sections,
        { id: "hope:reach", text: RULE, scope: "session" },
      ],
    };
  });
};
