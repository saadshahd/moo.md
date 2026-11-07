import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { EFFORTS, TIERS } from "../config/schema.ts";
import { atomicWrite, isMissing } from "../state/fs.ts";
import { compareVersions } from "../state/format.ts";
import type { State } from "../state/open.ts";
import type { Card } from "../status/format.ts";

export type Tier = (typeof TIERS)[number];

export type Effort = (typeof EFFORTS)[number];

/** The model id each tier runs on. A tier is a field of the kind's table; `--model` needs an id. */
export const TIER_MODELS: Readonly<Record<Tier, string>> = {
	light: "claude-haiku-5-5",
	standard: "claude-sonnet-5-5",
	top: "claude-opus-5-5",
};

/** R5: the Claude Code version the runner was proven on. An older one starts no run. */
export const CLAUDE_FLOOR = "2.1.316";

/** Run settings: no approval prompt in a headless run, and nothing else (no sandbox, no deny rules). */
export const RUN_SETTINGS = JSON.stringify({
	permissions: { defaultMode: "bypassPermissions" },
});

export type RunSpec = {
	readonly model: string;
	readonly effort: Effort;
	/** The JSON Schema of the run's structured result. */
	readonly schema: object;
	/** A UUID. The run record saves it before launch (D1). */
	readonly sessionId: string;
};

/**
 * The one flag set for every `claude -p` call, the start check included, so the check proves the flags
 * a run uses (V1). The prompt goes on stdin, never in argv (V8). Never `--bare`, `--resume` or `--continue`:
 * bare mode reads neither the login nor the plan token, and CI never resumes a session (Q2).
 */
export const runArgs = ({
	model,
	effort,
	schema,
	sessionId,
}: RunSpec): string[] => [
	"-p",
	"--output-format",
	"stream-json",
	"--verbose",
	"--model",
	model,
	"--effort",
	effort,
	"--json-schema",
	JSON.stringify(schema),
	"--settings",
	RUN_SETTINGS,
	"--session-id",
	sessionId,
];

const Usage = z.looseObject({
	input_tokens: z.number().optional(),
	output_tokens: z.number().optional(),
	cache_creation_input_tokens: z.number().optional(),
});

const ModelUsage = z.looseObject({
	inputTokens: z.number().optional(),
	outputTokens: z.number().optional(),
	cacheCreationInputTokens: z.number().optional(),
	cacheReadInputTokens: z.number().optional(),
});

/** Tokens a run adds to the item's bill: input, output and cache writes. Cache reads are not counted (E1). */
const billed = (input = 0, output = 0, cacheWrite = 0) =>
	input + output + cacheWrite;

const Init = z.looseObject({
	type: z.literal("system"),
	subtype: z.literal("init"),
	apiKeySource: z.string().optional(),
	plugins: z.array(z.looseObject({ name: z.string() })).default([]),
});

const Assistant = z.looseObject({
	type: z.literal("assistant"),
	message: z.looseObject({
		id: z.string().optional(),
		usage: Usage.optional(),
	}),
});

const RateLimit = z.looseObject({
	type: z.literal("rate_limit_event"),
	rate_limit_info: z.looseObject({
		status: z.string(),
		resetsAt: z.number().optional(),
	}),
});

const Result = z.looseObject({
	type: z.literal("result"),
	subtype: z.string(),
	is_error: z.boolean(),
	session_id: z.string().optional(),
	result: z.string().optional(),
	structured_output: z.unknown().optional(),
	modelUsage: z.record(z.string(), ModelUsage).default({}),
});

/** What a finished `claude -p` process reported. Done is `succeeded`, and for an item also an artifact (R6). */
export type Finished = {
	readonly kind: "finished";
	readonly subtype: string;
	readonly isError: boolean;
	readonly sessionId: string | undefined;
	readonly text: string;
	readonly structured: unknown;
	/** Billed tokens, from the result's `modelUsage`. */
	readonly tokens: number;
	/** E4: tokens read from the prompt cache, which the bill does not count. */
	readonly cacheReadTokens: number;
	readonly plugins: readonly string[];
	/** `apiKeySource` from the init event. */
	readonly keySource: string | undefined;
};

export type RunOutcome =
	| Finished
	/** R4: zero calls until `until` (epoch ms). */
	| { readonly kind: "limited"; readonly until: number }
	/** No run started or no verdict could be read; `card` says why. */
	| { readonly kind: "held"; readonly card: Card }
	/** E1: the run was stopped at the item's token cap. */
	| { readonly kind: "over-cap"; readonly tokens: number };

export const succeeded = (outcome: Finished): boolean =>
	outcome.subtype === "success" && !outcome.isError;

export type RunRequest = {
	readonly prompt: string;
	readonly cwd: string;
	readonly model: string;
	readonly effort: Effort;
	readonly schema: object;
	/** Tokens the item may still spend. */
	readonly tokenCap?: number;
	readonly sessionId?: string;
	readonly signal?: AbortSignal;
	/** Called with the session id of each attempt, before its process starts. */
	readonly onSession?: (sessionId: string) => void;
	/** Called once, when the first model message arrives; the scheduler starts the runs that share this prefix after it (E4). */
	readonly onFirstToken?: () => void;
};

export type RunnerOptions = {
	readonly state: Pick<State, "dir" | "faults">;
	readonly binary?: string;
	/** Added to the process environment. An API key in the environment is passed on untouched (E6). */
	readonly env?: Readonly<Record<string, string>>;
	readonly floor?: string;
	/** The plugin the start check must find in `system/init`. */
	readonly plugin?: string;
	readonly now?: () => number;
	readonly sleep?: (ms: number) => Promise<void>;
	readonly random?: () => number;
	/** R5: tries of a run that hits the refresh-lock error. */
	readonly lockTries?: number;
	readonly lockBackoffMs?: number;
};

const LIMIT_TEXT = /usage limit|hit your limit|limit reached/i;

const LOCK_TEXT = /refresh[^\n]*lock|lock[^\n]*refresh/i;

/** R4: the reset time in a limit message, as epoch ms. Undefined when the message holds none this parser knows. */
export const parseLimit = (text: string): number | undefined => {
	const epoch = /limit reached\|(\d{9,13})/i.exec(text)?.[1];

	if (epoch !== undefined)
		return Number(epoch) < 1e12 ? Number(epoch) * 1000 : Number(epoch);

	const iso =
		/resets?(?: at)? (\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d))/i.exec(
			text,
		)?.[1];

	const parsed = iso === undefined ? Number.NaN : Date.parse(iso);

	return Number.isNaN(parsed) ? undefined : parsed;
};

const CREDENTIALS = "credentials.json";

/**
 * Runs `claude -p` as the owner's own unmodified `claude` binary, on their login or plan token.
 * Nothing starts until `start` passes the version floor (R5) and the start check (V1).
 */
export class ClaudeRunner {
	readonly #o: Required<Omit<RunnerOptions, "state" | "env">> &
		Pick<RunnerOptions, "state"> & { env: Readonly<Record<string, string>> };
	#blocked: Card | undefined;
	#limitedUntil = 0;
	#started = false;

	constructor(options: RunnerOptions) {
		this.#o = {
			binary: "claude",
			env: {},
			floor: CLAUDE_FLOOR,
			plugin: "hope",
			now: Date.now,
			sleep: Bun.sleep,
			random: Math.random,
			lockTries: 3,
			lockBackoffMs: 2000,
			...options,
		};
	}

	/** Epoch ms until which every run is held, or 0. */
	limitedUntil(): number {
		return this.#limitedUntil;
	}

	/** R4: holds every run until `until`, as a restart restores a saved limit. Never shortens a hold. */
	holdUntil(until: number): void {
		this.#limitedUntil = Math.max(this.#limitedUntil, until);
	}

	#env() {
		return { ...process.env, ...this.#o.env };
	}

	#hold(code: string, cause: string, fix: string): RunOutcome {
		this.#blocked = this.#o.state.faults.raise({ code, cause, fix });

		return { kind: "held", card: this.#blocked };
	}

	/** R5: the installed version, read before any model call. */
	async version(): Promise<string | undefined> {
		return new Promise((resolve) => {
			const child = spawn(this.#o.binary, ["--version"], { env: this.#env() });
			let out = "";

			child.stdout.on("data", (chunk) => (out += chunk));
			child.on("error", () => resolve(undefined));
			child.on("close", () => resolve(/\d+\.\d+\.\d+/.exec(out)?.[0]));
		});
	}

	/**
	 * R5, V1, E6: the version floor, then one `claude -p` with the runner's exact flags. It must return
	 * `subtype: success` and list the plugin under `plugins` in `system/init`; otherwise no run starts.
	 */
	async start(model: string = TIER_MODELS.light): Promise<RunOutcome> {
		this.#started = false;
		this.#blocked = undefined;

		const version = await this.version();

		const order =
			version === undefined
				? undefined
				: compareVersions(version, this.#o.floor);

		if (order === undefined || order < 0) {
			return this.#hold(
				"claude-too-old",
				`Claude Code ${version ?? "was not found"}; hum was proven on ${this.#o.floor} or later.`,
				"Update Claude Code: claude update.",
			);
		}

		const checked = await this.#attempt({
			prompt: 'Reply with the JSON {"ok":true}.',
			cwd: tmpdir(),
			model,
			effort: "low",
			schema: {
				type: "object",
				properties: { ok: { type: "boolean" } },
				required: ["ok"],
			},
		});

		if (checked.kind !== "finished")
			return checked.kind === "held"
				? checked
				: this.#hold(
						"start-check-failed",
						`The start check ended as ${checked.kind}.`,
						"Run it again once the limit resets.",
					);

		if (!succeeded(checked) || !checked.plugins.includes(this.#o.plugin)) {
			return this.#hold(
				"start-check-failed",
				`The start check returned ${checked.subtype}${checked.isError ? " with an error" : ""} and ${checked.plugins.includes(this.#o.plugin) ? "" : `no ${this.#o.plugin} plugin`}: ${checked.text.slice(0, 200)}`,
				"Check that claude runs signed in (not in bare mode) and that the hope plugin is installed.",
			);
		}

		this.#recordCredential(checked.keySource);
		this.#started = true;

		return checked;
	}

	/** E6: the credential is recorded at start. A different one later shows one card, and runs go on. */
	#recordCredential(keySource: string | undefined) {
		const credential =
			keySource !== undefined && keySource !== "none"
				? `api-key:${keySource}`
				: this.#env().CLAUDE_CODE_OAUTH_TOKEN
					? "oauth-token"
					: "login";

		const file = join(this.#o.state.dir, CREDENTIALS);
		let recorded: string | undefined;

		try {
			recorded = z
				.object({ credential: z.string() })
				.parse(JSON.parse(readFileSync(file, "utf8"))).credential;
		} catch (error) {
			if (!(error instanceof Error && isMissing(error))) throw error;
		}

		if (recorded === undefined) {
			mkdirSync(this.#o.state.dir, { recursive: true });
			atomicWrite(file, `${JSON.stringify({ credential })}\n`);

			return;
		}

		if (recorded !== credential) {
			this.#o.state.faults.raise({
				code: "credential-changed",
				cause: `claude now runs on ${credential}; it was recorded as ${recorded}.`,
				fix: `Runs go on. Delete ${file} to record ${credential} as the choice.`,
			});
		} else {
			this.#o.state.faults.clear("credential-changed");
		}
	}

	/** One run. Zero calls while limited; nothing runs before `start` has passed (V1). */
	async run(request: RunRequest): Promise<RunOutcome> {
		if (!this.#started) {
			return this.#blocked
				? { kind: "held", card: this.#blocked }
				: this.#hold(
						"runner-not-started",
						"A run was asked for before the start check passed.",
						"Start the runner first.",
					);
		}

		if (this.#o.now() < this.#limitedUntil)
			return { kind: "limited", until: this.#limitedUntil };

		return this.#attempt(request);
	}

	async #attempt(request: RunRequest): Promise<RunOutcome> {
		for (let attempt = 1; ; attempt++) {
			const sessionId =
				attempt === 1 ? (request.sessionId ?? randomUUID()) : randomUUID();

			request.onSession?.(sessionId);

			const outcome = await this.#spawn(request, sessionId);

			if (
				outcome.kind === "finished" &&
				outcome.isError &&
				LOCK_TEXT.test(outcome.text) &&
				attempt < this.#o.lockTries
			) {
				await this.#o.sleep(
					this.#o.lockBackoffMs * attempt * (0.5 + this.#o.random()),
				);
				continue;
			}

			return outcome;
		}
	}

	#spawn(request: RunRequest, sessionId: string): Promise<RunOutcome> {
		const { prompt, cwd, model, effort, schema, tokenCap, signal, onFirstToken } = request;

		return new Promise((resolve) => {
			const child = spawn(
				this.#o.binary,
				runArgs({ model, effort, schema, sessionId }),
				{ cwd, env: this.#env() },
			);

			const messages = new Map<string, number>();
			let plugins: string[] = [];
			let keySource: string | undefined;
			let rejectedUntil: number | undefined;
			let result: z.infer<typeof Result> | undefined;
			let stderr = "";
			let buffer = "";
			let settled = false;
			let tokenSeen = false;

			const settle = (outcome: RunOutcome) => {
				if (settled) return;

				settled = true;
				signal?.removeEventListener("abort", stop);
				resolve(outcome);
			};

			const stop = () => child.kill("SIGKILL");

			signal?.addEventListener("abort", stop, { once: true });

			if (signal?.aborted) stop();

			child.stdin.on("error", () => {});
			child.stdin.end(prompt);
			child.stderr.on("data", (chunk) => (stderr += chunk));
			child.on("error", (error) =>
				settle(
					this.#hold(
						"claude-not-found",
						`claude could not start: ${error.message}`,
						"Install Claude Code and sign in.",
					),
				),
			);

			const line = (text: string) => {
				let event: unknown;

				try {
					event = JSON.parse(text);
				} catch {
					return;
				}

				const init = Init.safeParse(event);

				if (init.success) {
					plugins = init.data.plugins.map((p) => p.name);
					keySource = init.data.apiKeySource;

					return;
				}

				const limit = RateLimit.safeParse(event);

				if (
					limit.success &&
					limit.data.rate_limit_info.status === "rejected" &&
					limit.data.rate_limit_info.resetsAt !== undefined
				) {
					rejectedUntil = limit.data.rate_limit_info.resetsAt * 1000;

					return;
				}

				const assistant = Assistant.safeParse(event);

				if (
					assistant.success &&
					assistant.data.message.id !== undefined &&
					assistant.data.message.usage
				) {
					const u = assistant.data.message.usage;

					if (!tokenSeen) {
						tokenSeen = true;
						onFirstToken?.();
					}

					// One message streams several events; the last carries its final usage.
					messages.set(
						assistant.data.message.id,
						billed(
							u.input_tokens,
							u.output_tokens,
							u.cache_creation_input_tokens,
						),
					);

					const spent = [...messages.values()].reduce((a, b) => a + b, 0);

					if (tokenCap !== undefined && spent > tokenCap) {
						stop();
						settle({ kind: "over-cap", tokens: spent });
					}

					return;
				}

				const done = Result.safeParse(event);

				if (done.success) result = done.data;
			};

			child.stdout.on("data", (chunk) => {
				buffer += chunk;

				for (
					let at = buffer.indexOf("\n");
					at >= 0;
					at = buffer.indexOf("\n")
				) {
					line(buffer.slice(0, at));
					buffer = buffer.slice(at + 1);
				}
			});

			child.on("close", () => {
				if (buffer.trim() !== "") line(buffer);

				if (settled) return;

				if (!result) {
					return settle({
						kind: "finished",
						subtype: "no-result",
						isError: true,
						sessionId,
						text: stderr.trim().slice(-500),
						structured: undefined,
						tokens: 0,
					cacheReadTokens: 0,
						plugins,
						keySource,
					});
				}

				const text = result.result ?? "";

				if (
					result.is_error &&
					(rejectedUntil !== undefined || LIMIT_TEXT.test(text))
				) {
					const until = rejectedUntil ?? parseLimit(text);

					if (until === undefined) {
						return settle(
							this.#hold(
								"limit-unparsed",
								`claude refused with a usage limit and no reset time hum can read: ${text.slice(0, 200)}`,
								"Runs stay held. Tell hum's maintainer the message, or restart the worker once the limit has reset.",
							),
						);
					}

					this.#limitedUntil = until;

					return settle({ kind: "limited", until });
				}

				const tokens = Object.values(result.modelUsage).reduce(
					(sum, u) =>
						sum +
						billed(u.inputTokens, u.outputTokens, u.cacheCreationInputTokens),
					0,
				);

				const cacheReadTokens = Object.values(result.modelUsage).reduce((sum, u) => sum + (u.cacheReadInputTokens ?? 0), 0);

				if (tokenCap !== undefined && tokens > tokenCap)
					return settle({ kind: "over-cap", tokens });

				settle({
					kind: "finished",
					subtype: result.subtype,
					isError: result.is_error,
					sessionId: result.session_id ?? sessionId,
					text,
					structured: result.structured_output,
					tokens,
					cacheReadTokens,
					plugins,
					keySource,
				});
			});
		});
	}
}
