import { z } from "zod";
import type { ThreadEntry } from "../adapter-api.ts";
import { OWNER_APPROVAL } from "./merge.ts";
import { DATA_RULE, fenced } from "./prose.ts";
import { bareWord } from "./question.ts";

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

/** The option an answer picks by its hidden marker, else by its first word matching an option exactly. */
export const matchOption = (
	{ text, option }: Pick<ThreadEntry, "text" | "option">,
	options: readonly string[],
): Resolution | undefined => {
	if (option !== undefined) return { source: "marker", option };

	if (options.length === 0) return { source: "free" };

	const word = firstWordOf(text);
	const found = options.find((candidate) => candidate.toLowerCase() === word);

	return found === undefined
		? undefined
		: { source: "first-word", option: found };
};

/** The cheap model call that picks one of a question's options for a reply no marker or exact word settles. */
export const replyQuestion = (
	question: string,
	options: readonly string[],
	reply: string,
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

export const DISPOSITIONS = ["applied", "held", "dropped"] as const;

export type Disposition = {
	readonly disposition: (typeof DISPOSITIONS)[number];
	readonly why: string;
};

export type DisposeFacts = {
	readonly resolution: Resolution;
	/** An earlier answer to the same question was applied. */
	readonly answeredBefore: boolean;
	readonly stage: Stage;
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
