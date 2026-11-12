import { join } from "node:path";
import type { GitIdentityRead } from "../adapters/git.ts";
import { type RawConfig, readConfigDir } from "../config/load.ts";
import { noGitIdentity, type Result } from "../config/refusal.ts";
import { DefaultsConfig, type HumConfig, Kind } from "../config/schema.ts";

/** Where the shipped defaults sit, in the package or in the owner's `node_modules`. */
const DEFAULTS_DIR = join(import.meta.dir, "..", "..", "defaults");

export const shippedRaw = (): RawConfig => readConfigDir(DEFAULTS_DIR);

/** The config hum ships with, parsed: its settings and its kinds. */
export const shippedConfig = () => {
	const raw = shippedRaw();

	return { hum: DefaultsConfig.parse(raw.hum), kinds: Object.fromEntries(Object.entries(raw.kinds).map(([name, file]) => [name, Kind.parse(file)])) };
};

/** The shipped settings as an owner's own: they commit as the identity git config holds, and refuse without one. */
export const shippedSettingsAs = (git: GitIdentityRead): Result<HumConfig> =>
	git.found ? { ok: true, value: { ...DefaultsConfig.parse(shippedRaw().hum), commitIdentity: git.identity } } : { ok: false, refusal: noGitIdentity(git.missing) };
