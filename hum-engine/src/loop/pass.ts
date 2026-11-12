import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { WorkSource } from "../adapter-api.ts";
import type { Config } from "../config/load.ts";
import type { PastChange } from "../decide/labels.ts";
import type { State } from "../state/open.ts";
import { checkNameOf, fileChecks, filedFrom } from "./check-item.ts";
import { type CiLogs, logNames } from "./ci.ts";
import { type Proposer, groupNotes } from "./groups.ts";
import { withoutCovered } from "./memory.ts";
import { breakNotes, ownerNotes, planChangingNotes, type RawComment, saveNotes } from "./notes.ts";
import { type RepeatGroup, type ReviewNote, noteKey } from "./records.ts";

export type LoopPass = {
	readonly state: State;
	readonly config: Config;
	readonly workSource: Pick<WorkSource, "fileFollowUp" | "comment">;
	readonly now: () => number;
	/** The owner's review comments and bodies since a time. */
	readonly comments: (since: number) => Promise<readonly RawComment[]>;
	/** The merged changes on the base, oldest first. */
	readonly history: () => Promise<readonly PastChange[]>;
	readonly hunkOf: (sha: string, file: string | undefined) => Promise<string>;
	readonly propose: Proposer;
	readonly trusts: (models: readonly string[]) => boolean;
	readonly ciLogs: CiLogs;
	/** The repo's `.hum/memory.md`, when it has one. */
	readonly memoryPath?: string;
};

const EPOCH = 0;

/** Review comments are read from the newest one already saved; the saved key makes any overlap add nothing. */
const sinceOfLastComment = (state: State): number => Math.max(EPOCH, ...state.notes.list().filter(({ source }) => source === "review-comment").map(({ at }) => at));

const unappliedCard = (state: State) => (extension: string, signals: readonly string[]) => {
	state.faults.raise({
		code: "signal-not-applied",
		item: extension,
		cause: `Hunks in ${extension} files are not parsed, so ${signals.join(" and ")} did not run on them.`,
		fix: "The other signals still decide; add the language to the parsed languages to apply these.",
	});
};

/** Step 1: the owner's notes from each source, saved once. Returns the ones this pass added. */
export const collectNotes = async ({ state, config, comments, history, hunkOf }: LoopPass): Promise<ReviewNote[]> =>
	saveNotes(state, [
		...ownerNotes(await comments(sinceOfLastComment(state)), config.hum.ownerLogins),
		...planChangingNotes(state.answers.list()),
		...(await breakNotes(await history(), config.hum.changeLabels, hunkOf)),
	]);

/** Step 6: a landed check item whose name the next CI run's log shows. */
export const confirmChecks = async ({ state, ciLogs, now }: Pick<LoopPass, "state" | "ciLogs" | "now">): Promise<void> => {
	for (const group of state.repeats.list()) {
		const merge = group.item === undefined ? undefined : state.merges.get(group.item);

		if (group.checked || !merge) continue;

		const logs = await ciLogs(merge.at);

		if (logs.some((log) => logNames(log, group.key))) state.repeats.put(group.key, { ...group, checked: { at: now(), check: checkNameOf(group.key) } });
	}
};

const missesOf = (state: State, group: RepeatGroup): ReviewNote[] =>
	group.checked === undefined ? [] : group.notes.flatMap((key) => state.notes.get(key) ?? []).filter((note) => note.at > (group.checked?.at ?? 0) && !group.misses.includes(noteKey(note)));

/** Step 7: memory.md drops the entries a check now covers, and a note that came after the check ran reopens its item as a miss. */
export const closeLoop = async ({ state, workSource, memoryPath }: Pick<LoopPass, "state" | "workSource" | "memoryPath">): Promise<void> => {
	const covered = new Set(state.repeats.list().flatMap((group) => (group.checked ? group.notes : [])));

	if (memoryPath !== undefined && covered.size > 0 && existsSync(memoryPath)) {
		const text = readFileSync(memoryPath, "utf8");
		const kept = withoutCovered(text, covered);

		if (kept !== text) writeFileSync(memoryPath, kept);
	}

	for (const group of state.repeats.list()) {
		const missed = missesOf(state, group);

		if (group.item === undefined || missed.length === 0) continue;

		for (const note of missed)
			await workSource.fileFollowUp(filedFrom(group.key), { title: `Check missed ${note.sourceId}: ${group.item}`, body: `Kind: fix\n\nThe check for ${group.item} ran in CI and a later review note still repeated its rule.\n\n> ${note.text}\n\n\`\`\`diff\n${note.hunk}\n\`\`\`\n\nThe hunk is a failing case the check must catch.` });

		state.repeats.put(group.key, { ...group, misses: [...group.misses, ...missed.map(noteKey)] });
	}
};

/** One pass of the loop: collect, find repeats, file checks, confirm CI ran them, close the loop. */
export const runLoopPass = async (pass: LoopPass): Promise<void> => {
	const { state, config, workSource, propose, trusts } = pass;

	await groupNotes({ state, propose, trusts, onUnapplied: unappliedCard(state) }, await collectNotes(pass));
	await fileChecks({ state, workSource, repeatAt: config.hum.repeatAt, checkKind: config.hum.checkKind });
	await confirmChecks(pass);
	await closeLoop(pass);
};
