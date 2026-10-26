import * as z from "./vendor/zod-mini.js";

/** The factory's GitHub App acting as its bot user; `name` is its REST login, `<slug>[bot]`. */
export const Bot = z.object({
  token: z.string(),
  expiresAt: z.string(),
  name: z.string(),
  email: z.string(),
});

export type Bot = z.infer<typeof Bot>;

/** An installation token lives an hour; it is renewed this long before it expires. */
export const RENEW_BEFORE_MS = 10 * 60_000;

export function needsRenew(bot: Bot | null, now: number): boolean {
  return bot === null || Date.parse(bot.expiresAt) - now < RENEW_BEFORE_MS;
}

/**
 * Environment that makes `gh`, `git push` and `git commit` act as the factory's bot: `GH_TOKEN`
 * for `gh`, a git credential helper that hands git the same token in place of the user's keychain
 * login, and the bot as the commits' author.
 */
export function botEnv(bot: Bot) {
  return {
    GH_TOKEN: bot.token,
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: "",
    GIT_CONFIG_KEY_1: "credential.helper",
    GIT_CONFIG_VALUE_1: "!gh auth git-credential",
    GIT_AUTHOR_NAME: bot.name,
    GIT_AUTHOR_EMAIL: bot.email,
    GIT_COMMITTER_NAME: bot.name,
    GIT_COMMITTER_EMAIL: bot.email,
  };
}
