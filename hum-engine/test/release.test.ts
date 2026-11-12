import { expect, test } from "bun:test";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { type Baseline, checkBump, PLACEHOLDER_VERSION } from "../tools/release/compare.ts";
import { extractSurface, type Surface } from "../tools/release/surface.ts";

const REPO_ROOT = join(import.meta.dir, "../..");

const WORKFLOW = join(REPO_ROOT, ".github/workflows/hum.yml");

const Lockfile = z.object({ packages: z.record(z.string(), z.tuple([z.string()], z.unknown())) });

const Workflow = z.object({ jobs: z.record(z.string(), z.object({ steps: z.array(z.object({ uses: z.string().optional() })) })) });

const settingsSchema = { properties: { limit: { type: "number" } }, required: ["limit"] };

const surface: Surface = {
	config: { schema: settingsSchema, defaults: { limit: 5 } },
	adapterApi: { "src/adapter-api.ts": { ADAPTER_API_VERSION: { type: "1", value: 1 } } },
	savedState: { "src/state/format.ts": { Envelope: { type: "Envelope" } } },
	commands: { arguments: [], options: [], commands: { claim: { arguments: ["<item>"], options: ["--renew"], commands: {} } } },
	exportedTypes: { entryPoints: { ".": "./src/index.ts" }, symbols: { "src/index.ts": { loadConfig: { type: "() => void" } } } },
};

const withConfig = (config: Surface["config"]): Surface => ({ ...surface, config });

const withClaim = (claim: Surface["commands"]): Surface => ({ ...surface, commands: { ...surface.commands, commands: { claim } } });

const addedSetting = withConfig({
	schema: { properties: { limit: { type: "number" }, wait: { type: "number" } }, required: ["limit"] },
	defaults: { limit: 5, wait: 1 },
});

const removedSetting = withConfig({ schema: { properties: {}, required: [] }, defaults: {} });

const requiredSetting = withConfig({
	schema: { properties: { limit: { type: "number" }, wait: { type: "number" } }, required: ["limit", "wait"] },
	defaults: { limit: 5, wait: 1 },
});

const strictSettings = withConfig({ schema: { ...settingsSchema, additionalProperties: false }, defaults: surface.config.defaults });

const boundedSetting = withConfig({
	schema: { properties: { limit: { type: "number", maximum: 9 } }, required: ["limit"] },
	defaults: surface.config.defaults,
});

const changedDefault = withConfig({ schema: settingsSchema, defaults: { limit: 6 } });

const optionalFlag = withClaim({ arguments: ["<item>"], options: ["--renew", "--ttl <seconds>"], commands: {} });

const requiredArgument = withClaim({ arguments: ["<item>", "<holder>"], options: ["--renew"], commands: {} });

const published = (version: string): Baseline => ({ version, surface });

const next = (version: string, changed: Surface = surface) => ({ version, surface: changed });

test.each([
	["the same surface under a patch bump", "1.2.3", surface, "1.2.4", true],
	["an added setting under a patch bump", "1.2.3", addedSetting, "1.2.4", false],
	["an added setting under a minor bump", "1.2.3", addedSetting, "1.3.0", true],
	["an added optional flag under a patch bump", "1.2.3", optionalFlag, "1.2.4", false],
	["an added optional flag under a minor bump", "1.2.3", optionalFlag, "1.3.0", true],
	["a removed setting under a minor bump", "1.2.3", removedSetting, "1.3.0", false],
	["a removed setting under a major bump", "1.2.3", removedSetting, "2.0.0", true],
	["an added required setting under a minor bump", "1.2.3", requiredSetting, "1.3.0", false],
	["a closed settings object under a minor bump", "1.2.3", strictSettings, "1.3.0", false],
	["a new bound on a setting under a minor bump", "1.2.3", boundedSetting, "1.3.0", false],
	["a changed default under a minor bump", "1.2.3", changedDefault, "1.3.0", false],
	["an added required argument under a minor bump", "1.2.3", requiredArgument, "1.3.0", false],
	["an added required argument under a major bump", "1.2.3", requiredArgument, "2.0.0", true],
	["an added setting below 1.0 under a patch bump", "0.1.0", addedSetting, "0.1.1", true],
	["a removed setting below 1.0 under a patch bump", "0.1.0", removedSetting, "0.1.1", false],
	["a removed setting below 1.0 under a minor bump", "0.1.0", removedSetting, "0.2.0", true],
	["a version equal to the published one", "1.2.3", surface, "1.2.3", false],
	["a prerelease version", "1.2.3", surface, "1.3.0-rc.1", false],
] as const)("the semver check on %s", (_name, version, changed, bumped, accepted) => {
	expect(checkBump(published(version), next(bumped, changed)).ok).toBe(accepted);
});

test("the semver check names the changes that need the larger bump", () => {
	const verdict = checkBump(published("1.2.3"), next("1.2.4", removedSetting));

	expect(verdict).toMatchObject({ ok: false, reasons: expect.arrayContaining(["config defaults.limit: removed, needs a major bump"]) });
});

test.each([
	["nothing published", undefined, true],
	["a placeholder that carries no surface", { version: PLACEHOLDER_VERSION, surface: undefined }, true],
	["a release that carries no surface", { version: "0.3.0", surface: undefined }, false],
] as const)("the semver check with %s", (_name, baseline, accepted) => {
	expect(checkBump(baseline, next("0.4.0")).ok).toBe(accepted);
});

test("the surface holds the five parts, read from the sources a release publishes", async () => {
	const extracted = await extractSurface();

	expect(Object.keys(extracted).toSorted()).toEqual(Object.keys(surface).toSorted());
	expect(extracted.adapterApi["src/adapter-api.ts"]).toHaveProperty("ADAPTER_API_VERSION");
	expect(extracted.exportedTypes.symbols["src/index.ts"]).toHaveProperty("loadConfig");
	expect(extracted.commands.commands).toHaveProperty("claim");
	expect(JSON.stringify(extracted.config.schema)).not.toContain('"description"');
});

test("the surface shows a class's public method signatures and what a type alias points at", async () => {
	const symbols = (await extractSurface()).exportedTypes.symbols["src/index.ts"];

	expect(symbols?.Faults?.type).toContain("clear: (");
	expect(symbols?.Faults?.type).not.toContain("#");
	expect(symbols?.Slot?.type).toContain('"work-source"');
});

test("the engine's lockfile resolves one xstate, so an owner's install holds one", async () => {
	const lock = Lockfile.parse(Bun.JSONC.parse(await Bun.file(join(import.meta.dir, "../bun.lock")).text()));
	const resolved = Object.values(lock.packages).filter(([id]) => id.startsWith("xstate@"));

	expect(resolved).toHaveLength(1);
});

test("every action in the release workflow is pinned to a full commit sha", async () => {
	const workflow = Workflow.parse(parse(await Bun.file(WORKFLOW).text()));
	const used = Object.values(workflow.jobs).flatMap(({ steps }) => steps.flatMap(({ uses }) => (uses === undefined ? [] : [uses])));

	expect(used.length).toBeGreaterThan(0);
	expect(used.filter((action) => !/@[0-9a-f]{40}$/.test(action))).toEqual([]);
});

test.skipIf(!Bun.which("actionlint"))("actionlint passes on the release workflow", () => {
	const lint = Bun.spawnSync(["actionlint", "-no-color", WORKFLOW], { cwd: REPO_ROOT });

	expect(lint.stdout.toString() + lint.stderr.toString()).toBe("");
	expect(lint.exitCode).toBe(0);
});
