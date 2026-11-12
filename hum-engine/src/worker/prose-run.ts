import { type AgentDecisionExecutor, createDecisionRequest, getMessageText, renderDecisionAttempts, resolveDecision } from "@statelyai/agent";
import { type Finished, hasSucceeded } from "../adapters/claude-p.ts";
import { type EventPick, type JsonSchema, PROSE_STATES, type ProsePurpose, pickSchema, readPick } from "../decide/prose.ts";

const RESULT_EXCERPT = 300;

/** One agent run answering in `schema`. It settles only with a finished run; a limit, a hold or a stop never settles it. */
type AnswerRun = (prompt: string, schema: JsonSchema) => Promise<Finished>;

export type ProseDecision = { readonly pick: EventPick; readonly models: readonly string[] };

export type ProseOptions = {
	readonly purpose: ProsePurpose;
	readonly prompt: string;
	/** The diff a pick's citations must point into; empty for a plan. */
	readonly diff: string;
	readonly model: string;
	readonly run: AnswerRun;
	/** Whether the machine takes this event now; every offered event by default. */
	readonly canTake?: (event: string) => boolean;
};

const offer = (events: readonly string[]): string =>
	`Answer with one event: ${events.join(", ")}. Set sure to false when you are not sure; the safer event is then taken. Give your reason in a sentence.`;

/**
 * A plan or review run's pick of the next event, through the agent library's decide executor: the run is offered
 * only the events the state takes, and code checks the artifact behind its pick. A pick that fails its check is
 * refused and the run is made again with the reason; once the library's retries are spent the decision throws.
 */
export const decideProse = async ({ purpose, prompt, diff, model, run, canTake = () => true }: ProseOptions): Promise<ProseDecision> => {
	let taken: ProseDecision | undefined;

	const decide: AgentDecisionExecutor = async (request) => {
		const offered = request.events.map(({ type }) => type);
		const feedback = renderDecisionAttempts(request).map(getMessageText);
		const outcome = await run([prompt, offer(offered), ...feedback].join("\n\n"), pickSchema(offered));

		if (!hasSucceeded(outcome)) return { rejected: { failure: "invalid-payload", reason: `the run ended as ${outcome.subtype}: ${outcome.text.slice(0, RESULT_EXCERPT)}` } };

		const read = readPick(purpose, outcome, diff);

		if (!read.ok) return { rejected: { failure: "invalid-payload", reason: read.why } };

		taken = { pick: read.pick, models: outcome.models };

		return { event: { type: read.pick.event } };
	};

	const request = createDecisionRequest({ name: purpose, model, events: [...PROSE_STATES[purpose].events] });
	const event = await resolveDecision(request, { decide }, { canTake: ({ type }) => canTake(type) });

	if (taken?.pick.event !== event.type) throw new Error(`the ${purpose} decision took ${event.type}, which no run picked`);

	return taken;
};
