import { isPaused, type RunOutcome } from "../adapters/claude-p.ts";
import { hashJson } from "../config/hash.ts";
import { asJson, type Json } from "../config/json.ts";
import type { DoneBy } from "../decide/merge.ts";
import { SPLIT } from "../decide/prose.ts";
import { type EventLog, KeptOutcome, type NewEvent, type SavedEvent } from "./events.ts";
import type { BegunRun, RunKey, RunLaunch, RunRecords } from "./runs.ts";

/** A record of one type, as the log keeps it. */
type Entry<Type extends SavedEvent["type"]> = Extract<SavedEvent, { readonly type: Type }>;

/** What a judge picked for the item, as the log keeps it. */
export type Picked = Entry<"picked">["payload"];

/** The item whose machine a pass starts, and the version of its kind machine. */
type MachineOf = { readonly itemId: string; readonly machineVersion: string };

/**
 * A pass starts the item's machine over from its initial state; a pass that restores a saved wait starts none. A pass
 * starts it afresh when nothing saved is left to go on from, and no answer kept before then stands for a run after it.
 */
export const machineStarted = ({ itemId, machineVersion, afresh }: MachineOf & { readonly afresh: boolean }): NewEvent => ({ source: "machine", itemId, machineVersion, type: "machine-started", payload: { afresh } });

/** The item's change no longer held on the newest base, so its progress is dropped and its next pass builds it there again. */
export const rebuilt = (itemId: string, why: string): NewEvent => ({ source: "landing", itemId, type: "rebuilt", payload: { why } });

/** The owner's answer took effect on the item, keyed by when they gave it, so applying it again adds nothing. */
export const answerApplied = (itemId: string, at: number): NewEvent => ({ source: "thread", sourceId: `answer:${at}`, itemId, type: "answer-applied", payload: {} });

/** What one model run is asked, and whether an answer the log keeps to the same question stands in for running it. */
export type Ask = {
	readonly key: RunKey;
	readonly launch: RunLaunch;
	/** The version of the item's kind machine the run is made under. */
	readonly machineVersion: string;
	/** What the run is asked, given only for a run whose answer is all it does: a kept answer to it is read back, and nothing runs. */
	readonly question?: Json;
};

/** A kept answer as the run's outcome; JSON keeps no key whose value is undefined. */
const outcomeOf = (kept: KeptOutcome): RunOutcome => (kept.kind === "finished" ? { ...kept, sessionId: kept.sessionId, structured: kept.structured, keySource: kept.keySource } : kept);

/**
 * A model run's outcome. The run is saved as begun before it starts, and an outcome that answers, as a finished run or
 * one past its cap does, is kept in the item's log under the run's key before this returns, so the caller ends the
 * run's record after it, and a run that starts again under the same key keeps nothing more. A kept answer to the same
 * question stands in for the run: `run` is not called. A run that ends with no answer (a limit, a hold or a stop)
 * keeps nothing, and its next call runs again.
 */
export const answerOnce = async (
	{ events, runs }: { readonly events: EventLog; readonly runs: RunRecords },
	{ key, launch, machineVersion, question }: Ask,
	run: (begun: BegunRun) => Promise<RunOutcome>,
): Promise<{ readonly begun: BegunRun; readonly outcome: RunOutcome }> => {
	const begun = runs.begin(key, launch);
	const asked = question === undefined ? undefined : hashJson({ run: key.run, question });
	const kept = asked === undefined ? undefined : foldItem(events.list(key.itemId)).answers[asked];

	if (kept) return { begun, outcome: outcomeOf(kept) };

	const outcome = await run(begun);

	if (!isPaused(outcome)) {
		events.add({ itemId: key.itemId, source: "model", sourceId: `${key.run}#${key.attempt}`, machineVersion, type: "model-answered", payload: { run: key.run, attempt: key.attempt, question: asked, outcome: KeptOutcome.parse(asJson(outcome)) } });
	}

	return { begun, outcome };
};

/** Each judge's latest pick. */
type Picks = { readonly [Judge in Picked["judge"]]?: Extract<Picked, { judge: Judge }> };

/** An item's state from its log alone: the same log always folds the same. */
export type ItemFold = {
	/** The answers the log keeps since the owner last answered, counted by the run (its role) that gave them. */
	readonly runs: Readonly<Record<string, number>>;
	/** The times its change was built again from the newest base since the owner last answered. */
	readonly rebuilds: number;
	/** The answers kept since the item last started afresh and the owner last answered, by the question each answered. */
	readonly answers: Readonly<Record<string, KeptOutcome>>;
	readonly picks: Picks;
	/** How the change that ends at `head` reaches done if it merges as landing last found it; absent where landing never judged it. */
	readonly landing?: Entry<"landing-found">["payload"];
	readonly merged: boolean;
};

/** The fold after a kept answer: it counts for its run, as a fix run's does toward the cap, and an answer to a question stands for the next run asked it. */
const withAnswer = (fold: ItemFold, { run, question, outcome }: Entry<"model-answered">["payload"]): ItemFold => ({
	...fold,
	runs: { ...fold.runs, [run]: (fold.runs[run] ?? 0) + 1 },
	answers: question === undefined ? fold.answers : { ...fold.answers, [question]: outcome },
});

const stepItem = (fold: ItemFold, entry: SavedEvent): ItemFold => {
	switch (entry.type) {
		case "machine-started":
			return entry.payload.afresh ? { ...fold, answers: {} } : fold;
		case "model-answered":
			return withAnswer(fold, entry.payload);
		case "picked":
			return { ...fold, picks: { ...fold.picks, [entry.payload.judge]: entry.payload } };
		case "landing-found":
			return { ...fold, landing: entry.payload };
		case "answered":
			return fold;
		case "answer-applied":
			return { ...fold, runs: {}, rebuilds: 0, answers: {} };
		case "merged":
			return { ...fold, merged: true };
		case "rebuilt":
			return { ...fold, rebuilds: fold.rebuilds + 1 };
	}
};

/** An item's facts from its log alone: no model is asked and no effect runs. */
export const foldItem = (events: readonly SavedEvent[]): ItemFold => events.reduce(stepItem, { runs: {}, rebuilds: 0, answers: {}, picks: {}, merged: false });

/** Appends the fact unless the item's last fact of its kind is the same JSON, so a fact read back or a step retried adds nothing. */
const keepChanged = (events: EventLog, fact: NewEvent, last: NewEvent["payload"] | undefined): void => {
	if (last !== undefined && hashJson(asJson(last)) === hashJson(asJson(fact.payload))) return;

	events.add(fact);
};

/** Appends a judge's pick for the item, unless it is that judge's last pick again. */
export const keepPick = (events: EventLog, { itemId, pick }: { readonly itemId: string; readonly pick: Picked }): void =>
	keepChanged(events, { source: "judge", itemId, type: "picked", payload: pick }, foldItem(events.list(itemId)).picks[pick.judge]);

/** Appends how the change that ends at `head` reaches done if it merges as landing found it, unless the log last held the same. */
export const keepLanding = (events: EventLog, { itemId, head, doneBy }: { readonly itemId: string; readonly head: string; readonly doneBy: DoneBy }): void =>
	keepChanged(events, { source: "landing", itemId, type: "landing-found", payload: { head, doneBy } }, foldItem(events.list(itemId)).landing);

/** How the item reached done, once its change merged: split by its plan run's last pick, else as landing last found its change; unknown where landing never judged it. */
export const doneByOf = ({ merged, picks, landing }: ItemFold): DoneBy | undefined => {
	if (!merged) return undefined;

	return picks.plan?.pick.event === SPLIT ? "split" : landing?.doneBy;
};
