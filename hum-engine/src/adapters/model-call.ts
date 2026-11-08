import { tmpdir } from "node:os";
import { z } from "zod";
import type { Boundary, HumConfig } from "../config/schema.ts";
import { isMeasured, jsonSchemaOf } from "../decide/prose.ts";
import { SECOND_MS } from "../time.ts";
import { type RunOutcome, type Runner, succeeded } from "./claude-p.ts";

/** One question to the cheap model: the boundary it is measured at, the prompt, and the typed answer. */
export type Question<T> = { readonly boundary: Boundary; readonly prompt: string; readonly answer: z.ZodType<T> };

/** An answer counts only as a pick; anything else is an abstention, which marks the item unclear and never raises a level. */
export type Judgment<T> =
	| { readonly kind: "picked"; readonly value: T; readonly models: readonly string[] }
	| { readonly kind: "abstained"; readonly why: string };

export type ModelCall = <T>(question: Question<T>) => Promise<Judgment<T>>;

const NOT_ANSWERED: Readonly<Record<Exclude<RunOutcome, { kind: "finished" }>["kind"], string>> = {
	limited: "a usage limit refused the call",
	held: "the runner is held",
	"over-cap": "the call passed its token cap",
	stopped: "the call timed out",
};

const abstained = (why: string) => ({ kind: "abstained", why }) as const;

export type ModelCallOptions = {
	readonly model: string;
	readonly timeoutMs: number;
	/** Whether picks from these model ids count at this boundary. */
	readonly trusts: (boundary: Boundary, models: readonly string[]) => boolean;
};

/** The cheap model call through `claude -p`, as hope's judge calls it, with a typed answer by JSON schema. */
export const modelCallOver =
	(runner: Runner, { model, timeoutMs, trusts }: ModelCallOptions): ModelCall =>
	async ({ boundary, prompt, answer }) => {
		const outcome = await runner.run({
			prompt,
			cwd: tmpdir(),
			model,
			effort: "low",
			schema: jsonSchemaOf(answer),
			call: "judgment",
			signal: AbortSignal.timeout(timeoutMs),
		});

		if (outcome.kind !== "finished") return abstained(NOT_ANSWERED[outcome.kind]);

		if (!succeeded(outcome)) return abstained(`the call ended as ${outcome.subtype}`);

		if (!trusts(boundary, outcome.models)) return abstained(`${outcome.models.join(", ") || "no model"} has no measured rate at ${boundary}`);

		const parsed = answer.safeParse(outcome.structured);

		return parsed.success ? { kind: "picked", value: parsed.data, models: outcome.models } : abstained("the answer does not match its schema");
	};

/** The model call a config sets up: its decision model, its timeout, and its record of measured model ids. */
export const configuredModelCall = (runner: Runner, config: Pick<HumConfig, "decisionModel" | "modelCallTimeoutSeconds" | "measuredModels">): ModelCall =>
	modelCallOver(runner, {
		model: config.decisionModel,
		timeoutMs: config.modelCallTimeoutSeconds * SECOND_MS,
		trusts: (boundary, models) => isMeasured(models, config.measuredModels[boundary] ?? []),
	});
