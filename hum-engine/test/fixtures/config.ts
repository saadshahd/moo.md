import { join } from "node:path";
import { type Config, listHopeSkills, loadConfig, readConfigDir } from "../../src/config/load.ts";

export const root = join(import.meta.dir, "..", "..");

/** A JSON tree the tests edit in place. */
export type Tree = any; // oxlint-disable-line typescript/no-explicit-any

/** The shipped config as raw JSON, with one path rule (docs are low risk) and what setup adds: every wait gets a timeout and a place to go. */
export const rawConfig = (edit: (raw: Tree) => void = () => {}): Tree => {
	const raw: Tree = structuredClone(readConfigDir(join(root, "defaults")));

	raw.hum.paths = [{ glob: "docs/**", level: "low" }];

	for (const kind of Object.values<Tree>(raw.kinds)) {
		for (const node of Object.values<Tree>(kind.machine.states)) {
			if (node.tags?.some((tag: string) => tag === "wait" || tag === "owner-wait")) node.after = { "86400000": { target: "stuck" } };
		}
	}

	edit(raw);

	return raw;
};

export const hopeSkills = (): ReadonlySet<string> => listHopeSkills(join(root, "../hope"));

export const configWith = (edit: (raw: Tree) => void = () => {}): Config => {
	const loaded = loadConfig(rawConfig(edit), { env: { hopeSkills: hopeSkills() } });

	if (!loaded.ok) throw new Error(JSON.stringify(loaded.refusal));

	return loaded.value;
};
