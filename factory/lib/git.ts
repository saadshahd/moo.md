/**
 * The git config every factory git command runs under. The credential helpers are cleared, then
 * gh's is set, so git hands GitHub the user's gh login whatever the keychain holds. That helper
 * answers over HTTPS only, and a worker started by launchd has no SSH agent, so GitHub's SSH
 * remotes are rewritten to HTTPS. Signing is off: an unattended run can't answer a key's prompt.
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
