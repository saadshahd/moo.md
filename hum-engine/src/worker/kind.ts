import type { Item, Questions, WorkSource } from "../adapter-api.ts";
import type { ModelCall } from "../adapters/model-call.ts";
import type { Config } from "../config/load.ts";
import { declaredKind, kindQuestion, UNSURE } from "../decide/kind.ts";
import { PLAIN_QUESTIONS } from "../decide/question.ts";
import type { State } from "../state/open.ts";
import type { ItemKind } from "../state/saved.ts";
import { queueQuestion, releaseQuestions } from "./questions.ts";
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
 * An item's kind: the name its source gives it, else the model call's pick from the kinds, else the fallback kind.
 * A fallback is an abstention: the item is unclear.
 */
export const pickKind = async (o: Pick<KindContext, "config" | "judge">, item: Item, except?: string): Promise<ItemKind> => {
	const kinds = kindsBut(o, except);
	const declared = declaredKind(item, kinds, o.config.hum.kindLabels);

	if (declared !== undefined) return { item: item.id, kind: declared, from: "source" };

	const picked = await noKind(o, item, kinds);

	return "kind" in picked ? { item: item.id, kind: picked.kind, from: "model" } : { item: item.id, kind: o.config.hum.fallbackKind, from: "fallback", why: picked.why };
};

/** Saves the item's kind and, for a fallback, asks the owner once for it; returns the kind's name. */
export const keepKind = async (o: KindContext, item: Item, kind: ItemKind, except?: string): Promise<string> => {
	o.state.itemKinds.put(item.id, kind);

	if (kind.from === "fallback") {
		queueQuestion(o, item, { text: PLAIN_QUESTIONS.kind, options: kindsBut(o, except), detail: `It runs as ${kind.kind} for now.` }, "kind");
		await releaseQuestions(o);
	}

	return kind.kind;
};

/** The kind the owner named in answer to the kind question, for an item still on its fallback kind. */
export const kindAnswered = (known: ItemKind, item: Item, kinds: readonly string[]): ItemKind | undefined => {
	const answer = known.from === "fallback" ? pickedAnswer(item.thread, kinds) : undefined;

	return answer?.option === undefined ? undefined : { item: item.id, kind: answer.option, from: "source" };
};

/** Drops what an item's run on its earlier kind left: its snapshot, its landing, its plan and its verdict. Its branch stays. */
export const forgetProgress = (state: State, id: string): void => {
	state.items.remove(id);
	state.landings.remove(id);
	state.plans.remove(id);
	state.verdicts.remove(id);
};
