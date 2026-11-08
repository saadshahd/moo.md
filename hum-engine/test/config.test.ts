import { expect, test } from "bun:test";
import { join } from "node:path";
import { createActor, SimulatedClock, waitFor } from "xstate";
import { restoreActor } from "xstate/persist";
import { z } from "zod";
import schemaFile from "../schema/hum.schema.json" with { type: "json" };
import {
	applyConfigChange,
	type Config,
	HumConfig,
	kindMachine,
	listHopeSkills,
	loadConfig,
	migrateConfig,
	Json,
	migrateSnapshot,
	OWNER_CHANGEABLE,
	pickTier,
	type Problem,
	type RawConfig,
	readConfigDir,
} from "../src/index.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";

const root = join(import.meta.dir, "..");
const env = { hopeSkills: listHopeSkills(join(root, "../hope")) };
const DAY = 86_400_000;

/** A JSON tree the tests edit in place. */
type Tree = any; // oxlint-disable-line typescript/no-explicit-any

const shipped = (): RawConfig => readConfigDir(join(root, "defaults"));
const clone = (raw: RawConfig): Tree => structuredClone(raw);

/** What setup does: give every wait a timeout and a place to go. */
const withTimeouts = (raw: RawConfig): RawConfig => {
	const next = clone(raw);

	for (const kind of Object.values<Tree>(next.kinds)) {
		for (const node of Object.values<Tree>(kind.machine.states)) {
			if (node.tags?.some((t: string) => t === "wait" || t === "owner-wait")) {
				node.after = { [DAY]: { target: "stuck" } };
			}
		}
	}

	return next;
};

const loaded = (raw: RawConfig): Config => {
	const result = loadConfig(raw, { env });

	if (!result.ok) throw new Error(result.refusal.message);

	return result.value;
};

const problemsOf = (raw: RawConfig): readonly Problem[] => {
	const result = loadConfig(raw, { env });

	if (result.ok) return [];

	if (result.refusal.code !== "invalid-config") throw new Error(result.refusal.message);

	return result.refusal.problems;
};

const change = (current: Config | undefined, candidate: RawConfig, extra: { branch?: string; saved?: { kind: string; state: string }[] } = {}) =>
	applyConfigChange(current, { candidate, branch: "main", ...extra }, { env });

test("as shipped, each default kind fails only on its waits having no timeout", () => {
	const problems = problemsOf(shipped());
	const kinds = new Set(Object.keys(shipped().kinds));

	expect(problems.length).toBeGreaterThan(0);
	expect(problems.every((p) => p.problem === "wait-without-timeout")).toBe(true);

	for (const kind of kinds) expect(problems.some((p) => "kind" in p && p.kind === kind)).toBe(true);
});

test("once a fixture fills the timeouts, each default kind passes every check", () => {
	const config = loaded(withTimeouts(shipped()));

	expect(Object.keys(config.kinds).sort()).toEqual(["check", "docs", "feature", "fix", "hotfix"]);

	for (const kind of Object.values(config.kinds)) expect(kindMachine(kind).id).toBe(kind.machine.id);
});

test("a rename that strands a saved item is refused; with a map the item restores", async () => {
	const before = loaded(withTimeouts(shipped()));
	const machine = kindMachine(before.kinds.feature!);
	const actor = createActor(machine).start();
	await waitFor(actor, (s) => s.matches("planning") === false || s.value === "planning");
	actor.send({ type: "plan-ready" });
	await waitFor(actor, (s) => s.value === "reviewing");
	actor.send({ type: "needs-owner" });
	expect(actor.getSnapshot().value).toBe("owner-review");
	const persisted = Json.parse(JSON.parse(JSON.stringify(actor.getPersistedSnapshot())));
	actor.stop();

	const renamed = (map: boolean): RawConfig => {
		const next = clone(withTimeouts(shipped()));
		const text = JSON.stringify(next.kinds.feature).replaceAll("owner-review", "deep-review");
		next.kinds.feature = JSON.parse(text);
		next.kinds.feature.machine.version = "2";

		if (map) next.kinds.feature.stateMap = { "1": { "owner-review": "deep-review" } };

		return next;
	};

	const saved = [{ kind: "feature", state: "owner-review" }];

	const refused = change(before, renamed(false), { saved });
	expect(refused.accepted).toBe(false);
	expect(refused.config).toBe(before);
	expect(!refused.accepted && refused.refusals[0]?.code).toBe("unmapped-state");

	const accepted = change(before, renamed(true), { saved });
	expect(accepted.accepted).toBe(true);

	if (!accepted.accepted) return;
	const next = accepted.config.kinds.feature!;
	const migrated = await migrateSnapshot(before.kinds.feature!, next, persisted);
	const clock = new SimulatedClock();
	// SAFETY: migrateSnapshot returns a snapshot the target machine's schema already validated.
	const restored = restoreActor(kindMachine(next), migrated as never, { clock }).start();
	expect(restored.getSnapshot().status).toBe("active");
	expect(restored.getSnapshot().value).toBe("deep-review");
	clock.increment(DAY);
	expect(restored.getSnapshot().value).toBe("stuck");
});

test("the previous schema migrates", () => {
	const previous = { schemaVersion: 1, name: "old" };

	const migrated = migrateConfig(previous, {
		current: 2,
		readable: [1, 2],
		migrations: { 1: ({ name, ...rest }) => ({ ...rest, title: name ?? "" }) },
	});

	expect(migrated).toEqual({ ok: true, value: { schemaVersion: 2, title: "old" } });
});

test("an unknown schema version is refused and names the step", () => {
	const newer = loadConfig({ ...shipped(), hum: { schemaVersion: 99 } }, { env });
	const older = loadConfig({ ...shipped(), hum: { schemaVersion: 0 } }, { env });

	expect(!newer.ok && newer.refusal.code).toBe("unknown-schema-version");
	expect(!newer.ok && newer.refusal.message).toContain("Update the engine");
	expect(!older.ok && older.refusal.message).toContain("/hum");
});

test("a missing hope skill is refused, naming the skill and the role", () => {
	const fake = { hopeSkills: new Set(["intent", "shape"]) };
	const result = loadConfig(withTimeouts(shipped()), { env: fake });

	expect(result.ok).toBe(false);
	expect(!result.ok && result.refusal.code === "invalid-config" && result.refusal.problems).toEqual([
		{ problem: "missing-hope-skill", skill: "hope:judge", role: "review" },
	]);
	expect(env.hopeSkills.has("judge")).toBe(true);
});

test("an unreachable state and a wait with no timeout give one refusal naming both; the old config stays", () => {
	const good = loaded(withTimeouts(shipped()));
	const bad = clone(withTimeouts(shipped()));
	bad.kinds.feature.machine.states.orphan = { tags: ["stuck"] };
	delete bad.kinds.feature.machine.states.asking.after;

	const result = change(good, bad);

	expect(result.accepted).toBe(false);
	expect(result.config).toBe(good);

	if (result.accepted) return;
	expect(result.refusals).toHaveLength(1);
	const refusal = result.refusals[0]!;
	expect(refusal.code).toBe("invalid-config");
	expect(refusal.message).toContain('state "orphan" cannot be reached');
	expect(refusal.message).toContain('wait "asking" has no timeout');
});

test("a state that never reaches done or stuck is refused", () => {
	const bad = clone(withTimeouts(shipped()));
	bad.kinds.feature.machine.states.trap = { on: { answered: { target: "trap" } } };
	bad.kinds.feature.machine.states.fixing.on = { "token-cap": { target: "asking" }, "plan-ready": { target: "trap" } };

	expect(problemsOf(bad)).toContainEqual({ kind: "feature", problem: "dead-end-state", state: "trap" });
});

test("a deleted role leaves an event with no source", () => {
	const bad = clone(withTimeouts(shipped()));
	delete bad.hum.roles.plan;

	const problems = problemsOf(bad);

	expect(problems).toContainEqual({ problem: "event-without-source", event: "plan-ready", source: "plan" });
});

test("an event no machine handles, and a waited event nobody declares, are refused", () => {
	const bad = clone(withTimeouts(shipped()));
	bad.hum.events.ghost = { source: "owner" };
	bad.kinds.docs.machine.states.asking.on.mystery = { target: "building" };

	const problems = problemsOf(bad);

	expect(problems).toContainEqual({ problem: "event-without-handler", event: "ghost" });
	expect(problems).toContainEqual({ problem: "event-without-source", event: "mystery", source: undefined });
});

test("a state that starts a run and waits on the owner is refused", () => {
	const bad = clone(withTimeouts(shipped()));
	bad.kinds.feature.machine.states.building.tags = ["owner-wait"];
	bad.kinds.feature.machine.states.building.after = { [DAY]: { target: "stuck" } };

	expect(problemsOf(bad)).toContainEqual({ kind: "feature", problem: "run-and-owner-wait", state: "building" });
});

test("every owner-changeable part maps to a key the hum.json schema holds", () => {
	const keys = Object.keys(HumConfig.shape);
	const properties = Object.keys(schemaFile.properties);

	for (const [part, key] of Object.entries(OWNER_CHANGEABLE)) {
		expect(keys, part).toContain(key);
		expect(properties, part).toContain(key);
	}

	const mapped: string[] = Object.values(OWNER_CHANGEABLE);

	for (const setting of Object.keys(SHIPPED_DEFAULTS)) expect(mapped, setting).toContain(setting);
});

test("settings an owner changes load as given, and a value that breaks its rule is refused", () => {
	const changed = {
		providerTimeoutSeconds: 12,
		providerBackoff: { firstSeconds: 1.5, maxSeconds: 20 },
		mergedShown: 5,
		statusReadTimeoutSeconds: 3,
		mergeTries: 2,
		writeRaceRetries: 0,
		itemReadsAtOnce: 2,
		restartBackoff: { firstSeconds: 2, maxSeconds: 30 },
		restartDelaySeconds: 20,
		ciWakeTimeoutMinutes: 30,
		ciSchedule: "0 6 * * 1-5",
	};

	const raw = clone(withTimeouts(shipped()));

	Object.assign(raw.hum, changed);
	expect(loaded(raw).hum).toMatchObject(changed);

	for (const refused of [{ providerBackoff: { firstSeconds: 40, maxSeconds: 20 } }, { mergedShown: 0 }, { mergeTries: 0 }, { ciSchedule: "61 * * * *" }, { restartDelaySeconds: 0.5 }]) {
		const bad = clone(withTimeouts(shipped()));

		Object.assign(bad.hum, refused);
		expect(loadConfig(bad, { env }).ok, JSON.stringify(refused)).toBe(false);
	}
});

test("the committed schema file matches the schema in code", () => {
	expect(schemaFile).toEqual(JSON.parse(JSON.stringify(z.toJSONSchema(HumConfig, { io: "input" }))));
});

test("a config change from a branch hum writes is refused and the last good config stays", () => {
	const good = loaded(withTimeouts(shipped()));
	const edited = clone(withTimeouts(shipped()));
	edited.hum.levels = ["low", "high"];
	edited.hum.paths = [];

	const fromRun = change(good, edited, { branch: "hum/run/7" });

	expect(fromRun.accepted).toBe(false);
	expect(fromRun.config).toBe(good);
	expect(!fromRun.accepted && fromRun.refusals[0]?.code).toBe("change-from-run");
});

test("a change from a claim branch is refused too, and the last good config's prefixes decide", () => {
	const good = loaded(withTimeouts(shipped()));
	const renamed = clone(withTimeouts(shipped()));
	renamed.hum.runBranchPrefix = "bots/run/";

	expect(change(good, renamed, { branch: "hum/claim/7" }).accepted).toBe(false);
	expect(change(good, renamed, { branch: "hum/run/7" }).accepted).toBe(false);
	expect(change(good, renamed, { branch: "main" }).accepted).toBe(true);
});

test("a hum.json without the branch and label keys gets the shipped names", () => {
	const raw = withTimeouts(shipped());
	const bare = clone(raw);
	delete bare.hum.runBranchPrefix;
	delete bare.hum.claimPrefix;
	delete bare.hum.readyLabel;

	expect(loaded(bare).hum).toMatchObject({ runBranchPrefix: "hum/run/", claimPrefix: "hum/claim/", readyLabel: "hum:ready" });
});

test("a branch prefix that makes no valid git branch, or two prefixes that overlap, are refused", () => {
	const spaced = clone(withTimeouts(shipped()));
	spaced.hum.claimPrefix = "hum claim/";
	const nested = clone(withTimeouts(shipped()));
	nested.hum.claimPrefix = "hum/run/claim/";

	const malformed = change(undefined, spaced);
	const overlapping = change(undefined, nested);

	expect(!malformed.accepted && malformed.refusals[0]?.code).toBe("malformed-config");
	expect(!overlapping.accepted && overlapping.refusals[0]?.message).toContain("overlap");
});

test("the hash ignores key order and changes with content", () => {
	const raw = withTimeouts(shipped());
	const reordered = JSON.parse(JSON.stringify(raw, (_key, v) => (v && Object(v) === v && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)));
	const edited = clone(raw);
	edited.roles["roles/build.md"] += "\nAlso run the linter.";

	expect(loaded(reordered).hash).toBe(loaded(raw).hash);
	expect(loaded(edited).hash).not.toBe(loaded(raw).hash);
});

test("a tier table with a gap is refused, and the most specific row wins", () => {
	const bad = clone(withTimeouts(shipped()));
	bad.kinds.docs.tiers = bad.kinds.docs.tiers.filter((row: Tree) => !(row.purpose === "build" && row.level === undefined));
	const tiers = loaded(withTimeouts(shipped())).kinds.feature!;

	expect(problemsOf(bad)).toContainEqual({ kind: "docs", problem: "tier-table-gap", purpose: "build", level: "low", size: "small" });
	expect(pickTier(tiers, { purpose: "build", level: "critical", size: "small" })).toMatchObject({ tier: "top", effort: "high" });
	expect(pickTier(tiers, { purpose: "build", level: "low", size: "small" })).toMatchObject({ tier: "standard", effort: "medium" });
});
