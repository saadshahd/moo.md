import { randomUUID } from "node:crypto";
import type { InspectionEvent } from "xstate";
import { isPaused, type RunOutcome } from "../adapters/claude-p.ts";
import { hashJson } from "../config/hash.ts";
import { asJson, type Json } from "../config/json.ts";
import type { PURPOSES } from "../config/schema.ts";
import type { DoneBy } from "../decide/merge.ts";
import { SPLIT } from "../decide/prose.ts";
import { type EventLog, KeptOutcome, MachineEvent, type NewEvent, type SavedEvent } from "./events.ts";
import type { BegunRun, RunKey, RunRecords } from "./runs.ts";

/** A record of one type, as the log keeps it. */
type Entry<Type extends SavedEvent["type"]> = Extract<SavedEvent, { readonly type: Type }>;

/** What a judge picked for the item, as the log keeps it. */
export type Picked = Entry<"picked">["payload"];

/** The actor's own start and stop belong to the process that runs it, never to the item. */
const LIFECYCLE: ReadonlySet<string> = new Set(["xstate.init", "xstate.stop"]);

/** The item a machine record is about, and the version of its kind machine the record is made under. */
type MachineOf = { readonly itemId: string; readonly machineVersion: string };

/** An inspector that appends each event the item's root machine takes to the item's log. */
export const recordMachine =
	(events: EventLog, { itemId, machineVersion }: MachineOf) =>
	(inspected: InspectionEvent): void => {
		if (inspected.type !== "@xstate.transition" || inspected.actorRef.sessionId !== inspected.rootId || LIFECYCLE.has(inspected.event.type)) return;

		events.add({ source: "machine", sourceId: randomUUID(), itemId, machineVersion, type: "machine-stepped", payload: { event: MachineEvent.parse(asJson(inspected.event)) } });
	};

/**
 * A pass starts the item's machine over from its initial state; a pass that restores a saved wait starts none. A pass
 * starts it afresh when nothing saved is left to go on from, and no answer kept before then stands for a run after it.
 */
export const machineStarted = ({ itemId, machineVersion, afresh }: MachineOf & { readonly afresh: boolean }): NewEvent => ({ source: "machine", sourceId: randomUUID(), itemId, machineVersion, type: "machine-started", payload: { afresh } });

/** The owner's answer on the item's thread, keyed by when it came, so every read of it adds one entry. */
export const ownerAnswered = (itemId: string, at: number): NewEvent => ({ source: "thread", sourceId: `answer:${at}`, itemId, type: "answered", payload: {} });

/** A judge's pick for the item. */
export const picked = (itemId: string, pick: Picked): NewEvent => ({ source: "judge", sourceId: randomUUID(), itemId, type: "picked", payload: pick });

/** What one model run is asked, and whether an answer the log keeps to the same question stands in for running it. */
export type Ask = {
	readonly key: RunKey;
	readonly launch: { readonly name: string; readonly sessionId?: string };
	/** The version of the item's kind machine the run is made under. */
	readonly machineVersion: string;
	/** What the run is asked, given only for a run whose answer is all it does: a kept answer to it is read back, and nothing runs. */
	readonly question?: Json;
};

/** A kept answer as the run's outcome; JSON keeps no key whose value is undefined. */
const outcomeOf = (kept: KeptOutcome): RunOutcome => (kept.kind === "finished" ? { ...kept, sessionId: kept.sessionId, structured: kept.structured, keySource: kept.keySource } : kept);

/**
 * A model run's outcome. The run is saved as begun before it starts, and an outcome that answers, as a finished run or
 * one past its cap does, is kept in the item's log before this returns, so the caller ends the run's record after it.
 * A kept answer to the same question stands in for the run: `run` is not called. A run that ends with no answer (a
 * limit, a hold or a stop) keeps nothing, and its next call runs again.
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
		events.add({ itemId: key.itemId, source: "model", sourceId: randomUUID(), machineVersion, type: "model-answered", payload: { run: key.run, attempt: key.attempt, question: asked, outcome: KeptOutcome.parse(asJson(outcome)) } });
	}

	return { begun, outcome };
};

/** Each judge's latest pick. */
type Picks = { readonly [Judge in Picked["judge"]]?: Extract<Picked, { judge: Judge }> };

/** An item's state from its log alone: the same log always folds the same. */
export type ItemFold = {
	/** The fix runs that finished since the owner last answered. */
	readonly fixRuns: number;
	/** The answers kept since the item last started afresh and the owner last answered, by the question each answered. */
	readonly answers: Readonly<Record<string, KeptOutcome>>;
	readonly picks: Picks;
	/** How the change that ends at `head` reaches done if it merges as landing last found it; absent where landing never judged it. */
	readonly landing?: Entry<"landing-found">["payload"];
	readonly merged: boolean;
};

/** The run purpose whose finished runs the fix cap counts. */
const FIX = "fix" satisfies (typeof PURPOSES)[number];

/** The fold after a kept answer: a finished fix run counts toward the cap, and an answer to a question stands for the next run asked it. */
const withAnswer = (fold: ItemFold, { run, question, outcome }: Entry<"model-answered">["payload"]): ItemFold => ({
	...fold,
	fixRuns: fold.fixRuns + Number(run === FIX && outcome.kind === "finished"),
	answers: question === undefined ? fold.answers : { ...fold.answers, [question]: outcome },
});

const stepItem = (fold: ItemFold, entry: SavedEvent): ItemFold => {
	switch (entry.type) {
		case "machine-stepped":
			return fold;
		case "machine-started":
			return entry.payload.afresh ? { ...fold, answers: {} } : fold;
		case "model-answered":
			return withAnswer(fold, entry.payload);
		case "picked":
			return { ...fold, picks: { ...fold.picks, [entry.payload.judge]: entry.payload } };
		case "landing-found":
			return { ...fold, landing: entry.payload };
		case "answered":
			return { ...fold, fixRuns: 0, answers: {} };
		case "merged":
			return { ...fold, merged: true };
	}
};

/** An item's facts from its log alone: no model is asked and no effect runs. */
export const foldItem = (events: readonly SavedEvent[]): ItemFold => events.reduce(stepItem, { fixRuns: 0, answers: {}, picks: {}, merged: false });

/** Appends how the change that ends at `head` reaches done if it merges as landing found it, when the log last held otherwise. */
export const keepLanding = (events: EventLog, { itemId, head, doneBy }: { readonly itemId: string; readonly head: string; readonly doneBy: DoneBy }): void => {
	const last = foldItem(events.list(itemId)).landing;

	if (last?.head === head && last.doneBy === doneBy) return;

	events.add({ source: "landing", sourceId: randomUUID(), itemId, type: "landing-found", payload: { head, doneBy } });
};

/** How the item reached done, once its change merged: split by its plan run's last pick, else as landing last found its change; unknown where landing never judged it. */
export const doneByOf = ({ merged, picks, landing }: ItemFold): DoneBy | undefined => {
	if (!merged) return undefined;

	return picks.plan?.pick.event === SPLIT ? "split" : landing?.doneBy;
};
