import { join } from "node:path";
import { BOUNDARIES } from "../../src/config/schema.ts";
import { type Config, listHopeSkills, loadConfig, readConfigDir } from "../../src/config/load.ts";
import { withTimeouts } from "../../src/setup/waits.ts";
import { OWNER } from "./identity.ts";
import { SHIM_MODEL } from "./shim.ts";

export const root = join(import.meta.dir, "..", "..");

/** A JSON tree the tests edit in place. */
export type Tree = any; // oxlint-disable-line typescript/no-explicit-any

/** The shipped config as raw JSON, with the one setting only the owner holds: who their commits are credited to. */
export const shippedRaw = (): Tree => {
	const raw: Tree = structuredClone(readConfigDir(join(root, "defaults")));

	raw.hum.commitIdentity = OWNER;

	return raw;
};

/** `raw` as setup leaves it when the owner answers no wait: each wait ends stuck after its proposed hours. */
export const withProposedTimeouts = (raw: Tree): Tree => ({ ...structuredClone(raw), kinds: withTimeouts(raw.kinds, {}) });

/**
 * The shipped config as setup writes it, with one path rule (docs are low risk). Tests run items as docs, the kind with
 * the fewest states, on changes of any path, and trust the shim's model at every boundary.
 */
export const rawConfig = (edit: (raw: Tree) => void = () => {}): Tree => {
	const raw: Tree = withProposedTimeouts(shippedRaw());

	raw.hum.paths = [{ glob: "docs/**", level: "low" }];
	raw.hum.docsOnly.paths = ["**"];
	raw.hum.checks = ["true"];
	raw.hum.measuredModels = Object.fromEntries(BOUNDARIES.map((boundary) => [boundary, { [SHIM_MODEL]: 1 }]));

	edit(raw);

	return raw;
};

export const hopeSkills = (): ReadonlySet<string> => listHopeSkills(join(root, "../hope"));

export const configWith = (edit: (raw: Tree) => void = () => {}): Config => {
	const loaded = loadConfig(rawConfig(edit), { env: { hopeSkills: hopeSkills() } });

	if (!loaded.ok) throw new Error(JSON.stringify(loaded.refusal));

	return loaded.value;
};
