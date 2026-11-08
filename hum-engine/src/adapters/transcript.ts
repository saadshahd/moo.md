import { z } from "zod";
import { epochMs } from "./limit.ts";

/** Tokens a run adds to the item's bill: input, output and cache writes. Cache reads are not counted. */
export const billed = (input: number, output: number, cacheWrite: number): number => input + output + cacheWrite;

const Counts = {
	input_tokens: z.number().default(0),
	output_tokens: z.number().default(0),
	cache_creation_input_tokens: z.number().default(0),
};

/** The advisor model's own calls ride in the message's `iterations`; the message's top-level counts leave them out. */
const ADVISOR_ITERATION = "advisor_message";

const Usage = z.looseObject({
	...Counts,
	cache_read_input_tokens: z.number().default(0),
	iterations: z.array(z.looseObject({ type: z.string(), ...Counts })).default([]),
});

type Usage = z.infer<typeof Usage>;

const advisorTokens = ({ iterations }: Usage): number =>
	iterations.filter(({ type }) => type === ADVISOR_ITERATION).reduce((sum, call) => sum + billed(call.input_tokens, call.output_tokens, call.cache_creation_input_tokens), 0);

/** The rows of a transcript that matter, each named by what it is. Any other row says nothing. */
const Row = z.union([
	z
		.looseObject({
			type: z.literal("assistant"),
			isApiErrorMessage: z.literal(true),
			error: z.literal("rate_limit"),
			quotaLimits: z.looseObject({ resetsAt: z.number().optional() }).optional(),
			message: z.looseObject({ content: z.array(z.looseObject({ text: z.string().optional() })).default([]) }).optional(),
		})
		.transform(({ quotaLimits, message }) => ({ kind: "limit", text: message?.content.map(({ text }) => text ?? "").join(" ").trim() ?? "", resetsAt: quotaLimits?.resetsAt === undefined ? undefined : epochMs(quotaLimits.resetsAt) }) as const),
	z
		.looseObject({ type: z.literal("assistant"), isApiErrorMessage: z.literal(true), error: z.string().default("api error") })
		.transform(({ error }) => ({ kind: "api-error", error }) as const),
	z
		.looseObject({ type: z.literal("assistant"), message: z.looseObject({ id: z.string(), model: z.string().optional(), usage: Usage }) })
		.transform(({ message: { id, model, usage } }) => ({ kind: "message", id, spent: { billed: billed(usage.input_tokens, usage.output_tokens, usage.cache_creation_input_tokens) + advisorTokens(usage), output: usage.output_tokens, cacheRead: usage.cache_read_input_tokens, model } }) as const),
	z
		.looseObject({ type: z.literal("attachment"), timestamp: z.iso.datetime(), attachment: z.looseObject({ type: z.literal("structured_output"), data: z.unknown() }) })
		.transform(({ timestamp, attachment }) => ({ kind: "structured", data: attachment.data, at: Date.parse(timestamp) }) as const),
]);

type Row = z.infer<typeof Row>;

/** What one message cost. A message streams as several rows that each repeat its final usage, so cost is kept by message id. */
type Spent = { readonly billed: number; readonly output: number; readonly cacheRead: number; readonly model: string | undefined };

/** What a background run's transcript says so far. */
export type RunTranscript = {
	readonly messages: Readonly<Record<string, Spent>>;
	/** The structured result and the epoch ms it was written. */
	readonly structured: { readonly data: unknown; readonly at: number } | undefined;
	/** The API's error, when the run ended on one. */
	readonly apiError: string | undefined;
	/** The usage limit the run ran into: the reset time as epoch ms when the row carries one, and the row's own words. */
	readonly limit: { readonly resetsAt: number | undefined; readonly text: string } | undefined;
};

/** A line that is no JSON, such as a last row still being written, says nothing. */
const parseRow = (line: string): Row | undefined => {
	try {
		return Row.safeParse(JSON.parse(line)).data;
	} catch {
		return undefined;
	}
};

const readRow = (t: RunTranscript, row: Row | undefined): RunTranscript => {
	if (row?.kind === "limit") return { ...t, limit: { resetsAt: row.resetsAt, text: row.text } };

	if (row?.kind === "api-error") return { ...t, apiError: row.error };

	if (row?.kind === "message") return { ...t, messages: { ...t.messages, [row.id]: row.spent } };

	return row?.kind === "structured" ? { ...t, structured: { data: row.data, at: row.at } } : t;
};

const EMPTY: RunTranscript = { messages: {}, structured: undefined, apiError: undefined, limit: undefined };

/** Reads a run's transcript file. Tokens are summed over distinct message ids, as `-p` sums its `modelUsage`. */
export const readTranscript = (jsonl: string): RunTranscript => jsonl.split("\n").filter(Boolean).reduce((t, line) => readRow(t, parseRow(line)), EMPTY);

const sumOf = (t: RunTranscript, field: (spent: Spent) => number): number => Object.values(t.messages).reduce((sum, spent) => sum + field(spent), 0);

export const billedTokens = (t: RunTranscript): number => sumOf(t, (spent) => spent.billed);

/** Output tokens the transcript holds, which the job's own count is compared with. */
export const outputTokens = (t: RunTranscript): number => sumOf(t, (spent) => spent.output);

export const cacheReadTokens = (t: RunTranscript): number => sumOf(t, (spent) => spent.cacheRead);

/** The model ids that answered, each once. */
export const modelsOf = (t: RunTranscript): string[] => [...new Set(Object.values(t.messages).flatMap(({ model }) => (model === undefined ? [] : [model])))];
