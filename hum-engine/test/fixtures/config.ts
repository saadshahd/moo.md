import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BOUNDARIES, HumConfig } from "../../src/config/schema.ts";
import { type Config, listPluginSkills, loadConfig, readConfigDir } from "../../src/config/load.ts";
import { judgeHash } from "../../src/measure/judges.ts";
import { withTimeouts } from "../../src/setup/waits.ts";
import { OWNER } from "./identity.ts";
import { SHIM_MODEL } from "./shim.ts";
import { MOO_PLUGINS } from "../../src/service/plugins.ts";

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

/** A rate of 1 for the shim's model and each model the tiers name, at every boundary, measured on the judges `raw` has. */
export const trustedScores = (raw: Tree): Tree => {
	const judges = { hum: HumConfig.parse(raw.hum), roles: raw.roles };

	return Object.fromEntries(BOUNDARIES.map((boundary) => [boundary, Object.fromEntries([SHIM_MODEL, ...Object.values<string>(raw.hum.models)].map((model) => [model, { rate: 1, judgeHash: judgeHash(boundary, judges) }]))]));
};

/**
 * The shipped config as setup writes it, with one path rule (docs are low risk). Tests run items as docs, the kind with
 * the fewest states, on changes of any path, and trust the shim's model and each model the tiers name at every boundary.
 */
export const rawConfig = (edit: (raw: Tree) => void = () => {}): Tree => {
	const raw: Tree = withProposedTimeouts(shippedRaw());

	raw.hum.paths = [{ glob: "docs/**", level: "low" }];
	raw.hum.docsOnly.paths = ["**"];
	raw.hum.checks = ["true"];
	raw.hum.measuredModels = trustedScores(raw);

	edit(raw);

	return raw;
};

/** The glob a design critic's changes live under, as roundup's desktop app keeps its source. */
export const CRITIC_PATHS = ["apps/desktop/src/**"];

/**
 * `raw` with a design-critic role a repo adds: it runs on the top tier after the feature kind's review approves a
 * change that touches CRITIC_PATHS, and its request-changes goes to a fix run as the review's does. Each part is what
 * the repo writes in its own `.hum/`.
 */
export const withCritic = (raw: Tree): Tree => {
	const feature = raw.kinds.feature;
	const { states } = feature.machine;

	raw.hum.roles["design-critic"] = { file: "roles/design-critic.md", purpose: "review", skills: [] };
	raw.roles["roles/design-critic.md"] = "You are the design critic. Judge whether the change keeps the design system.\n";
	feature.tiers.push({ purpose: "review", role: "design-critic", tier: "top", effort: "high" });
	feature.machine.version = "2";
	states.reviewing.on.approve = [{ target: "critiquing", guard: { type: "touches", params: { paths: CRITIC_PATHS } } }, { target: "merging" }];
	states.critiquing = {
		invoke: { src: "design-critic", onError: { target: "stuck" } },
		on: { approve: { target: "merging" }, "request-changes": { target: "fixing" }, "needs-owner": { target: "owner-review" } },
	};

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

export const installedSkills = (): ReadonlySet<string> => new Set(MOO_PLUGINS.flatMap((plugin) => listPluginSkills(plugin, join(root, "..", plugin))));

/** The shipped config with `edit` applied, loaded as if hope and the plugin skills in `installed` were installed. */
export const configWith = (edit: (raw: Tree) => void = () => {}, installed: readonly string[] = []): Config => {
	const loaded = loadConfig(rawConfig(edit), { env: { installedSkills: new Set([...installedSkills(), ...installed]) } });

	if (!loaded.ok) throw new Error(JSON.stringify(loaded.refusal));

	return loaded.value;
};
