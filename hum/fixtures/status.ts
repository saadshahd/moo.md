import type { Status } from "../../hum-engine/src/status/format.ts";

export const NOW = 1_800_000_000_000;

const ago = (seconds: number): number => NOW - seconds * 1000;

const NO_CONTROLS = { choices: [], answer: false, skip: false, runNow: false, noteTo: [] };

const FEATURE_STEPS = ["planning", "building", "checking", "reviewing", "owner-review", "merging", "stuck", "done"].map((name) => ({ name, waitsOnOwner: name === "owner-review" }));

/** A status file with something in every section, in the shape the engine writes. */
export const fullStatus: Status = {
	format: 3,
	writtenAt: ago(5),
	workers: { mac: ago(40), ci: ago(360) },
	engine: { version: "0.3.0", adapterApi: 1, configSchema: 1, latest: "0.4.0" },
	questions: [
		{ item: "68", text: "Which title should the release note carry?", options: ["short", "long"], since: ago(5580) },
		{ item: "seed-2", text: "May the run publish the package to npm?", options: [], since: ago(90) },
	],
	cards: [
		{ kind: "fault", key: "run-error:71", item: "71", code: "run-error", cause: "The run for 71 failed: the checks still fail after 3 fixes.", fix: "hum tries the item again when its claim lapses.", action: { label: "Run it again", answer: "retry" }, since: ago(300) },
		{ kind: "limited", key: "usage-limit", code: "usage-limit", cause: "The plan's usage limit is reached.", fix: "Runs resume when the limit resets.", since: ago(1200) },
		{ kind: "waiting", key: "waiting:74", item: "74", code: "review", cause: "The change touches the release workflow and waits for your review.", fix: "Approve it, or comment what to change.", action: { label: "Approve", answer: "approve" }, since: ago(600) },
	],
	open: [
		{ item: "72", title: "Rename the release script and update every workflow that calls it", kind: "feature", flowVersion: "3", steps: FEATURE_STEPS, at: "building", since: ago(240), running: true, controls: { ...NO_CONTROLS, noteTo: ["building", "checking", "reviewing", "owner-review", "merging", "stuck"] } },
		{ item: "seed-3", title: "Write the note", kind: "docs", flowVersion: "2", steps: [{ name: "writing", waitsOnOwner: false }, { name: "checking", waitsOnOwner: false }, { name: "done", waitsOnOwner: false }], at: "checking", since: ago(30), running: true, controls: NO_CONTROLS },
		{ item: "74", kind: "feature", flowVersion: "3", steps: FEATURE_STEPS, at: "owner-review", since: ago(600), running: false, controls: { ...NO_CONTROLS, choices: [{ label: "Approve", event: "owner-approved" }], answer: true, noteTo: ["building", "checking", "reviewing", "owner-review", "merging", "stuck"] } },
	],
	merged: [{ item: "69", title: "Fix the typo in the README", level: "low", mergedAt: ago(7200) }],
	choices: [{ item: "70", text: 'Chose "short" over long without you.', at: ago(900), why: "each option touches only this change's own files, at level low", files: ["docs/release-note.md"], result: "merged" }],
	rules: [],
	possibleRepeats: [],
	unusedMemory: [],
	measure: {
		merges: 20,
		abandoned: 3,
		notes: 0.4,
		questions: 0.2,
		tokens: 310_000,
		window: 20,
		byPath: [],
		byDoneBy: [
			{ doneBy: "checks", merges: 9, reverted: 1, fixed: 2 },
			{ doneBy: "review", merges: 8, reverted: 0, fixed: 1 },
		],
	},
};
