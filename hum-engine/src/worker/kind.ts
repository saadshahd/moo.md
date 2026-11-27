import type { Item, Questions, WorkSource } from "../adapter-api.ts";
import type { ModelCall } from "../adapters/model-call.ts";
import type { Config } from "../config/load.ts";
import { declaredKind, kindQuestion, UNSURE } from "../decide/kind.ts";
import { PLAIN_QUESTIONS } from "../decide/question.ts";
import type { State } from "../state/open.ts";
import type { ItemKind } from "../state/saved.ts";
import { queuedKey, queueQuestion } from "./questions.ts";
import { pickedAnswer } from "./thread.ts";

export type KindContext = {
	readonly state: State;
	readonly config: Config;
	readonly judge: ModelCall;
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly now: () => number;
};

/** Why the model call gave no kind it may use. */
const noKind = async (o: Pick<KindContext, "config" | "judge">, item: Item, kinds: readonly string[]): Promise<{ kind: string } | { why: string }> => {
	const judged = await o.judge({ ...kindQuestion(item, { kinds, kindMeanings: o.config.hum.kindMeanings }), item: item.id });

	if (judged.kind === "abstained") return { why: judged.why };

	return judged.value.kind === UNSURE ? { why: "the model call could not tell" } : { kind: judged.value.kind };
};

/** The kinds an item may be: every kind but `except`, for an item whose change showed it is not that kind. */
const kindsBut = (o: Pick<KindContext, "config">, except: string | undefined): string[] => o.config.hum.kinds.filter((kind) => kind !== except);

/**
 * An item's kind: the name its source gives it, else the owner's default kind, else the model call's pick from the
 * kinds, else the fallback kind. A fallback is an abstention: the item is unclear.
 */
export const pickKind = async (o: Pick<KindContext, "config" | "judge">, item: Item, except?: string): Promise<ItemKind> => {
	const kinds = kindsBut(o, except);
	const declared = declaredKind(item, kinds, o.config.hum.kindLabels) ?? kinds.find((kind) => kind === o.config.hum.defaultKind);

	if (declared !== undefined) return { item: item.id, kind: declared, from: "source" };

	const picked = await noKind(o, item, kinds);

	return "kind" in picked ? { item: item.id, kind: picked.kind, from: "model" } : { item: item.id, kind: o.config.hum.fallbackKind, from: "fallback", why: picked.why };
};

/** Saves the item's kind and, for a fallback, queues one question to the owner for it; returns the kind's name. */
export const keepKind = (o: Pick<KindContext, "state" | "config" | "now">, item: Item, kind: ItemKind, except?: string): string => {
	o.state.itemKinds.put(item.id, kind);

	if (kind.from === "fallback") queueQuestion(o, item, { text: PLAIN_QUESTIONS.kind, options: kindsBut(o, except), detail: `It runs as ${kind.kind} for now.` }, "kind");

	return kind.kind;
};

/** The kind the owner named in answer to the kind question, for an item still on its fallback kind. */
export const kindAnswered = (known: ItemKind, item: Item, kinds: readonly string[]): ItemKind | undefined => {
	const answer = known.from === "fallback" ? pickedAnswer(item.thread, kinds) : undefined;

	return answer?.option === undefined ? undefined : { item: item.id, kind: answer.option, from: "source" };
};

/** Whether hum started the item and its next pass goes on from what it saved: a snapshot or a landing. */
export const hasProgress = (state: State, id: string): boolean => state.items.savedOf(id) !== undefined || state.landings.get(id) !== undefined;

/** Drops what an item's run on its earlier kind left: its snapshot, its landing, its plan, its verdict and its repro. Its next run restarts its branch at the base. */
export const forgetProgress = (state: State, id: string): void => {
	state.items.remove(id);
	state.landings.remove(id);
	state.plans.remove(id);
	state.verdicts.remove(id);
	state.repros.remove(id);
};

/** Drops all that takes an item up again: its progress, its park and its queued questions. */
export const forgetItem = (state: State, id: string): void => {
	forgetProgress(state, id);
	state.parked.remove(id);

	for (const queued of state.questions.list()) if (queued.item === id) state.questions.remove(queuedKey(queued));
};
