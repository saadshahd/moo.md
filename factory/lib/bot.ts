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
 * The git config every factory git command runs under. The credential helpers are cleared, then
 * gh's is set, so git hands GitHub the bot's token in place of the user's keychain login. That
 * helper answers over HTTPS only, and a run's sandbox blocks SSH, so GitHub's SSH remotes are
 * rewritten to HTTPS. Signing is off: a user's global `commit.gpgsign` would send a run after a
 * key its sandbox can't reach.
 */
const GIT_CONFIG = [
  ["credential.helper", ""],
  ["credential.helper", "!gh auth git-credential"],
  ["url.https://github.com/.insteadOf", "git@github.com:"],
  ["url.https://github.com/.insteadOf", "ssh://git@github.com/"],
  ["commit.gpgsign", "false"],
] as const;

/** `GIT_CONFIG` as git reads it from the environment: a count, then a key and a value per entry. */
export function gitConfigEnv() {
  return Object.fromEntries([
    ["GIT_CONFIG_COUNT", String(GIT_CONFIG.length)],
    ...GIT_CONFIG.flatMap(([key, value], i) => [
      [`GIT_CONFIG_KEY_${i}`, key],
      [`GIT_CONFIG_VALUE_${i}`, value],
    ]),
  ]);
}

/**
 * Environment that makes `gh`, `git push` and `git commit` act as the factory's bot: `GH_TOKEN`
 * for `gh`, the factory's git config, and the bot as the commits' author.
 */
export function botEnv(bot: Bot) {
  return {
    GH_TOKEN: bot.token,
    ...gitConfigEnv(),
    GIT_AUTHOR_NAME: bot.name,
    GIT_AUTHOR_EMAIL: bot.email,
    GIT_COMMITTER_NAME: bot.name,
    GIT_COMMITTER_EMAIL: bot.email,
  };
}
