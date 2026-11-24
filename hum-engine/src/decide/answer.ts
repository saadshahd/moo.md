import { z } from "zod";
import type { ThreadEntry } from "../adapter-api.ts";
import type { HumConfig } from "../config/schema.ts";
import { OWNER_APPROVAL } from "./merge.ts";
import { DATA_RULE, fenced } from "./prose.ts";
import { bareWord, isOverCapStop, OVER_CAP_OPTIONS } from "./question.ts";

/** The answer option that runs a parked item again from the start. */
export const RUN_AGAIN = "retry";

/** What the owner may answer an item parked for each reason. */
export const PARK_OPTIONS = { stuck: [RUN_AGAIN], review: [OWNER_APPROVAL, RUN_AGAIN] } as const;

/** Every option hum's own questions offer: a park's actions, the token cap's, a kind and a level. Picking one steers the item; a run's question offers its own. */
export const humOptions = ({ kinds, levels }: Pick<HumConfig, "kinds" | "levels">): ReadonlySet<string> =>
	new Set([...Object.values(PARK_OPTIONS).flat(), ...Object.values(OVER_CAP_OPTIONS), ...kinds, ...levels.map(({ name }) => name)]);

/** What the model call answers when none of the question's options fits the reply. */
export const NONE_OF_THESE = "none of these";

/** How an answer came to pick its option, strongest first. */
export type Resolution =
	| { readonly source: "marker"; readonly option?: string }
	| { readonly source: "free" }
	| { readonly source: "first-word"; readonly option: string }
	| { readonly source: "model"; readonly option: string }
	| { readonly source: "none-of-these" }
	| { readonly source: "abstained"; readonly why: string };

/** Each way an answer comes to pick its option, by the name its settled answer is saved under. */
export const RESOLUTION_SOURCES = {
	marker: "marker",
	free: "free",
	"first-word": "first-word",
	model: "model",
	"none-of-these": "none-of-these",
	abstained: "abstained",
} as const satisfies { readonly [S in Resolution["source"]]: S };

const firstWordOf = (text: string): string => bareWord(text.trim().split(/\s+/)[0] ?? "").toLowerCase();

/**
 * The option an answer picks by its hidden marker, else by its first word matching an option or an action exactly.
 * An action is an option the owner's own word picks even where the question takes free words; any other reply to such
 * a question is free.
 */
export const matchOption = (
	{ text, option }: Pick<ThreadEntry, "text" | "option">,
	options: readonly string[],
	actions: readonly string[] = [],
): Resolution | undefined => {
	if (option !== undefined) return { source: "marker", option };

	const word = firstWordOf(text);
	const found = [...options, ...actions].find((candidate) => candidate.toLowerCase() === word);

	if (found !== undefined) return { source: "first-word", option: found };

	return options.length === 0 ? { source: "free" } : undefined;
};

/** The cheap model call that picks one of a question's options for a reply no marker or exact word settles. */
export const replyQuestion = (
	{ question, options, reply }: { readonly question: string; readonly options: readonly string[]; readonly reply: string },
) => ({
	boundary: "reply-option" as const,
	prompt: [
		`The owner replied to a question. Pick the one option the reply chooses. Answer "${NONE_OF_THESE}" when the reply chooses none of them, chooses more than one, or you cannot tell.`,
		`Options: ${options.join(", ")}`,
		DATA_RULE,
		fenced("question", question),
		fenced("reply", reply),
	].join("\n\n"),
	answer: z.strictObject({ option: z.enum([...options, NONE_OF_THESE]) }),
});

/** Where the item stands when an answer is read. */
export type Stage =
	/** It waits on the owner. */
	| "waiting"
	/** It waits on the owner's approval of a change. */
	| "approval"
	/** A run is going. */
	| "running"
	/** It has merged, or otherwise ended. */
	| "ended";

/** The actions the owner's own word picks at each stage, whatever the question offers: approval where a change waits for it. */
export const STAGE_ACTIONS = {
	waiting: [],
	approval: [OWNER_APPROVAL],
	running: [],
	ended: [],
} as const satisfies Record<Stage, readonly string[]>;

export const DISPOSITIONS = ["applied", "held", "dropped"] as const;

export type Disposition = {
	readonly disposition: (typeof DISPOSITIONS)[number];
	readonly why: string;
};

type DisposeFacts = {
	readonly resolution: Resolution;
	/** An earlier answer to the same question was applied. */
	readonly answeredBefore: boolean;
	readonly stage: Stage;
	/** The question the owner reads, without its options and fold. */
	readonly question: string;
};

const dropped = (why: string): Disposition => ({ disposition: "dropped", why });

const isUnmatched = ({ source }: Resolution): boolean => source === "none-of-these" || source === "abstained";

/** Whether a model call, not the owner's own word, picked the approval. */
const isModelApproval = (resolution: Resolution): boolean => resolution.source === "model" && resolution.option === OWNER_APPROVAL;

/** D4: every answer is applied, held for the next state, or dropped with its reason. A model's pick never approves a change that waits for the owner's approval. */
export const dispose = ({
	resolution,
	answeredBefore,
	stage,
	question,
}: DisposeFacts): Disposition => {
	if (answeredBefore) return dropped("The question already has an answer.");

	if (isUnmatched(resolution)) return dropped("No option matched the reply.");

	if (isModelApproval(resolution) && stage === "approval") return dropped(`a model cannot approve it; reply with the word ${OWNER_APPROVAL}`);

	if (stage === "ended") return dropped("The item has ended.");

	if (stage === "running")
		return {
			disposition: "held",
			why: "A run is going. Your answer takes effect when it ends.",
		};

	if ("option" in resolution && isOverCapStop(question, resolution.option)) return { disposition: "applied", why: `The item stopped. Answer ${RUN_AGAIN} to start it again.` };

	return { disposition: "applied", why: "The run goes on with your answer." };
};

const EXCERPT = 60;

const excerptOf = (text: string): string => (text.length > EXCERPT ? `${text.slice(0, EXCERPT)}…` : text);

/** The stem a reply opens with, which finds it again on the thread: the answer's number and what became of it. */
export const replyStem = (ordinal: number, { disposition }: Disposition): string => `Answer ${ordinal} ${disposition}:`;

const pickedBy = (resolution: Resolution, text: string): string => ("option" in resolution && resolution.option !== undefined ? resolution.option : `"${excerptOf(text)}"`);

/** The reply posted on the thread for an answer. A dropped reply names the options, so the owner can answer again. */
export const replyText = (ordinal: number, outcome: Disposition, resolution: Resolution, options: readonly string[], text: string): string => {
	const choices = outcome.disposition === "dropped" && options.length > 0 ? ` Options: ${options.join(", ")}.` : "";
	const picked = outcome.disposition === "dropped" ? "" : ` ${pickedBy(resolution, text)}.`;

	return `${replyStem(ordinal, outcome)}${picked} ${outcome.why}${choices}`;
};
