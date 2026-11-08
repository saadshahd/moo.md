import type { Status } from "../../hum-engine/src/status/format.ts";

export const NOW = 1_800_000_000_000;

const ago = (seconds: number): number => NOW - seconds * 1000;

/** A status file with something in every section, in the shape the engine writes. */
export const fullStatus: Status = {
	format: 2,
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
	inFlight: [
		{ item: "72", title: "Rename the release script and update every workflow that calls it", level: "medium", state: "building", since: ago(240), unclear: false },
		{ item: "seed-3", title: "Write the note", level: "high", state: "checking", since: ago(30), unclear: true },
	],
	merged: [{ item: "69", title: "Fix the typo in the README", level: "low", mergedAt: ago(7200) }],
	choices: [{ item: "70", text: 'Chose "short" over long without you.', at: ago(900) }],
	rules: [],
	possibleRepeats: [],
	unusedMemory: [],
	measure: { merges: 20, abandoned: 3, notes: 0.4, questions: 0.2, tokens: 310_000, window: 20, byPath: [] },
};
