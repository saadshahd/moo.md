import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BOUNDARIES } from "../../src/config/schema.ts";
import { type Config, listPluginSkills, loadConfig, readConfigDir } from "../../src/config/load.ts";
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

/** Writes `raw` as the folder readConfigDir reads: hum.json, a file per kind and the role prompts. */
export const writeConfigDir = (folder: string, raw: Tree): void => {
	const put = (path: string, text: string) => {
		mkdirSync(dirname(join(folder, path)), { recursive: true });
		writeFileSync(join(folder, path), text);
	};

	put("hum.json", JSON.stringify(raw.hum));

	for (const [name, kind] of Object.entries<object>(raw.kinds)) put(`kinds/${name}.json`, JSON.stringify(kind));

	for (const [path, text] of Object.entries<string>(raw.roles)) put(path, text);
};

export const installedSkills = (): ReadonlySet<string> => new Set(listPluginSkills("hope", join(root, "../hope")));

/** The shipped config with `edit` applied, loaded as if hope and the plugin skills in `installed` were installed. */
export const configWith = (edit: (raw: Tree) => void = () => {}, installed: readonly string[] = []): Config => {
	const loaded = loadConfig(rawConfig(edit), { env: { installedSkills: new Set([...installedSkills(), ...installed]) } });

	if (!loaded.ok) throw new Error(JSON.stringify(loaded.refusal));

	return loaded.value;
};
