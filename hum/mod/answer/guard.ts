import { humSays } from "../says.ts";

/** What answering a prompt decided: pass it on, or keep it from Claude with a reason. */
export type Decision = { readonly kind: "pass" } | { readonly kind: "drop"; readonly reason: string };

type GuardSteps<R> = {
	/** Whether answer mode is on as the prompt arrives. */
	readonly isAnswering: () => Promise<boolean>;
	readonly decide: () => Promise<Decision>;
	readonly pass: () => Promise<R>;
	readonly drop: (reason: string) => R;
	readonly show: (message: string) => void;
};

const messageOf = (error: Error): string => humSays(error.message);

/**
 * Hooks fail open, with one exception: a failure while answer mode is on drops that prompt, because an answer that
 * reaches Claude is acted on as an instruction. The engine puts a dropped prompt's words back in the box. Every other
 * prompt passes on. Either way the failure shows once: as the drop's reason, or as a toast.
 */
export async function guardAnswer<R>(steps: GuardSteps<R>): Promise<R> {
	const answering = await steps.isAnswering().catch((error: Error) => error);

	if (answering instanceof Error) {
		steps.show(messageOf(answering));

		return steps.pass();
	}

	const decision = await steps.decide().catch((error: Error): Decision => {
		if (answering) return { kind: "drop", reason: messageOf(error) };

		steps.show(messageOf(error));

		return { kind: "pass" };
	});

	return decision.kind === "drop" ? steps.drop(decision.reason) : steps.pass();
}
