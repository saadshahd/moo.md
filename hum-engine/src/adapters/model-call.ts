import { tmpdir } from "node:os";
import { z } from "zod";
import type { Boundary, HumConfig } from "../config/schema.ts";
import { isTrusted, jsonSchemaOf } from "../decide/prose.ts";
import { SECOND_MS } from "../time.ts";
import { type RunOutcome, type Runner, succeeded } from "./claude-p.ts";

/** One question to the cheap model: the boundary it is measured at, the prompt, and the typed answer. */
export type Question<T> = { readonly boundary: Boundary; readonly prompt: string; readonly answer: z.ZodType<T>;
	/** The item the call is for: the tokens it spends join that item's total. */
	readonly item?: string;
	/** The pick feeds a report that decides nothing, so it needs no measured rate; the caller says what the rate is. */
	readonly reportOnly?: true;
};

/** An answer counts only as a pick; anything else is an abstention, which marks the item unclear and never raises a level. */
export type Judgment<T> =
	| { readonly kind: "picked"; readonly value: T; readonly models: readonly string[] }
	| { readonly kind: "abstained"; readonly why: string };

export type ModelCall = <T>(question: Question<T>) => Promise<Judgment<T>>;

const NOT_ANSWERED = {
	limited: "a usage limit refused the call",
	held: "the runner is held",
	"over-cap": "the call passed its token cap",
	stopped: "the call timed out",
} as const satisfies Record<Exclude<RunOutcome, { kind: "finished" }>["kind"], string>;

const abstained = (why: string) => ({ kind: "abstained", why }) as const;

export type ModelCallOptions = {
	readonly model: string;
	readonly timeoutMs: number;
	/** Whether picks from these model ids count at this boundary. */
	readonly trusts: (boundary: Boundary, models: readonly string[]) => boolean;
	/** Told the tokens every call spends, whatever it answers, with the item it was for. */
	readonly onSpent?: (item: string, tokens: number) => void;
};

/** The cheap model call through `claude -p`, as hope's judge calls it, with a typed answer by JSON schema. */
export const modelCallOver =
	(runner: Runner, { model, timeoutMs, trusts, onSpent }: ModelCallOptions): ModelCall =>
	async ({ boundary, prompt, answer, item, reportOnly }) => {
		const outcome = await runner.run({
			prompt,
			cwd: tmpdir(),
			model,
			effort: "low",
			schema: jsonSchemaOf(answer),
			call: "judgment",
			signal: AbortSignal.timeout(timeoutMs),
		});

		if (item !== undefined && (outcome.kind === "finished" || outcome.kind === "over-cap")) onSpent?.(item, outcome.tokens);

		if (outcome.kind !== "finished") return abstained(NOT_ANSWERED[outcome.kind]);

		if (!succeeded(outcome)) return abstained(`the call ended as ${outcome.subtype}`);

		if (reportOnly !== true && !trusts(boundary, outcome.models)) return abstained(`${outcome.models.join(", ") || "no model"} has no measured rate at ${boundary} that meets the bar`);

		const parsed = answer.safeParse(outcome.structured);

		return parsed.success ? { kind: "picked", value: parsed.data, models: outcome.models } : abstained("the answer does not match its schema");
	};

/** The model call a config sets up: its decision model, its timeout, and its record of measured model ids. */
export const configuredModelCall = (runner: Runner, config: Pick<HumConfig, "decisionModel" | "modelCallTimeoutSeconds" | "measuredModels" | "minJudgeRate">, onSpent?: ModelCallOptions["onSpent"]): ModelCall =>
	modelCallOver(runner, {
		model: config.decisionModel,
		timeoutMs: config.modelCallTimeoutSeconds * SECOND_MS,
		trusts: (boundary, models) => isTrusted(models, boundary, config),
		onSpent,
	});
