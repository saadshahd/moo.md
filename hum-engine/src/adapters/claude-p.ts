import { randomUUID } from "node:crypto";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pMemoize, { pMemoizeClear } from "p-memoize";
import pRetry from "p-retry";
import semver from "semver";
import { x } from "tinyexec";
import { z } from "zod";
import type { EFFORTS } from "../config/schema.ts";
import { rejectedToken, UNAUTHORIZED } from "../service/token.ts";
import { atomicWrite, isMissing } from "../state/fs.ts";
import type { State } from "../state/open.ts";
import { SECOND_MS } from "../time.ts";
import type { Card } from "../status/format.ts";

export type Effort = (typeof EFFORTS)[number];

/** The oldest Claude Code the runner was proven on. */
export const CLAUDE_FLOOR = "2.1.316";

/** No approval prompt in a headless run, and nothing else: no sandbox and no deny rules. */
export const RUN_SETTINGS = JSON.stringify({
	permissions: { defaultMode: "bypassPermissions" },
});

const REQUIRED_PLUGIN = "hope";

const LIMIT_KEY = "runner";

const LIMIT_UNPARSED = "limit-unparsed";

/** Epoch ms until which the saved usage limit holds every run, or 0. */
const savedLimitUntil = (state: Pick<State, "limit">): number => state.limit.get(LIMIT_KEY)?.until ?? 0;

const CREDENTIALS = "credentials.json";

const CARD_EXCERPT = 200;

const STDERR_TAIL = 500;

const LOCK_TRIES = 3;

const LOCK_BACKOFF_MS = 2000;

export type RunSpec = {
	readonly model: string;
	readonly effort: Effort;
	/** The JSON Schema of the run's structured result. */
	readonly schema: object;
	readonly sessionId: string;
};

/**
 * The one flag set for every `claude -p` call, the start check included, so the check proves the flags a run uses.
 * The prompt goes on stdin, never in argv. Never `--bare`, `--resume` or `--continue`: bare mode reads neither the
 * login nor the plan token, and a run never resumes a session.
 */
export const runArgs = ({ model, effort, schema, sessionId }: RunSpec): string[] => [
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
	input_tokens: z.number().default(0),
	output_tokens: z.number().default(0),
	cache_creation_input_tokens: z.number().default(0),
});

const ModelUsage = z.looseObject({
	inputTokens: z.number().default(0),
	outputTokens: z.number().default(0),
	cacheCreationInputTokens: z.number().default(0),
	cacheReadInputTokens: z.number().default(0),
});

const Init = z.looseObject({
	type: z.literal("system"),
	subtype: z.literal("init"),
	apiKeySource: z.string().optional(),
	plugins: z.array(z.looseObject({ name: z.string() })).default([]),
});

const Assistant = z.looseObject({
	type: z.literal("assistant"),
	message: z.looseObject({ id: z.string(), usage: Usage }),
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
	result: z.string().default(""),
	structured_output: z.unknown().optional(),
	modelUsage: z.record(z.string(), ModelUsage).default({}),
});

type Result = z.infer<typeof Result>;

const StreamEvent = z.discriminatedUnion("type", [Init, Assistant, RateLimit, Result]);

type StreamEvent = z.infer<typeof StreamEvent>;

/** Tokens a run adds to the item's bill: input, output and cache writes. Cache reads are not counted. */
const billed = (input: number, output: number, cacheWrite: number): number => input + output + cacheWrite;

/** What the stream has said so far. */
type Transcript = {
	readonly plugins: readonly string[];
	readonly keySource: string | undefined;
	/** One message streams several events, and the last carries its final usage; so billed tokens are kept per message id. */
	readonly messages: Readonly<Record<string, number>>;
	readonly rejectedUntil: number | undefined;
	readonly result: Result | undefined;
};

const EMPTY_TRANSCRIPT: Transcript = {
	plugins: [],
	keySource: undefined,
	messages: {},
	rejectedUntil: undefined,
	result: undefined,
};

const isRejection = (info: z.infer<typeof RateLimit>["rate_limit_info"]): info is { status: "rejected"; resetsAt: number } =>
	info.status === "rejected" && info.resetsAt !== undefined;

const readEvent = {
	system: (t, { plugins, apiKeySource }) => ({
		...t,
		plugins: plugins.map((plugin) => plugin.name),
		keySource: apiKeySource,
	}),
	assistant: (t, { message: { id, usage } }) => ({
		...t,
		messages: {
			...t.messages,
			[id]: billed(usage.input_tokens, usage.output_tokens, usage.cache_creation_input_tokens),
		},
	}),
	rate_limit_event: (t, { rate_limit_info }) => (isRejection(rate_limit_info) ? { ...t, rejectedUntil: rate_limit_info.resetsAt * SECOND_MS } : t),
	result: (t, result) => ({ ...t, result }),
} satisfies { readonly [K in StreamEvent["type"]]: (t: Transcript, event: Extract<StreamEvent, { type: K }>) => Transcript };

/** The event a stdout line holds; undefined for a line that is no JSON or no event this reader knows. */
const parseEvent = (line: string): StreamEvent | undefined => {
	try {
		return StreamEvent.safeParse(JSON.parse(line)).data;
	} catch {
		return undefined;
	}
};

/** The transcript after one stdout line. A line that is no event this reader knows changes nothing. */
const readLine = (t: Transcript, line: string): Transcript => {
	const event = parseEvent(line);

	// SAFETY: the table holds one reader per member of the union, keyed by its `type`.
	return event ? (readEvent[event.type] as (t: Transcript, event: StreamEvent) => Transcript)(t, event) : t;
};

const spentSoFar = (t: Transcript): number => Object.values(t.messages).reduce((sum, tokens) => sum + tokens, 0);

const hasFirstToken = (t: Transcript): boolean => Object.keys(t.messages).length > 0;

const isOverCap = (tokens: number, cap: number | undefined): boolean => cap !== undefined && tokens > cap;

/** What a finished `claude -p` process reported. Done is `succeeded`, and for an item also an artifact on its branch. */
export type Finished = {
	readonly kind: "finished";
	readonly subtype: string;
	readonly isError: boolean;
	readonly sessionId: string | undefined;
	readonly text: string;
	readonly structured: unknown;
	readonly tokens: number;
	/** Tokens read from the prompt cache, which the bill does not count. */
	readonly cacheReadTokens: number;
	readonly plugins: readonly string[];
	readonly keySource: string | undefined;
};

export type RunOutcome =
	| Finished
	/** Zero calls until `until` (epoch ms). */
	| { readonly kind: "limited"; readonly until: number }
	/** No run started or no verdict could be read; `card` says why. */
	| { readonly kind: "held"; readonly card: Card }
	/** The run was stopped at the item's token cap. */
	| { readonly kind: "over-cap"; readonly tokens: number };

/** What one process ended as, before the runner acts on a limit it could not read. */
type Ended = RunOutcome | { readonly kind: "limit-unparsed"; readonly text: string };

export const succeeded = (outcome: Finished): boolean => outcome.subtype === "success" && !outcome.isError;

const LIMIT_TEXT = /usage limit|hit your limit|limit reached/i;

const LOCK_TEXT = /refresh[^\n]*lock|lock[^\n]*refresh/i;

const LIMIT_EPOCH = /limit reached\|(\d{9,13})/i;

const LIMIT_ISO = /resets?(?: at)? (\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d))/i;

/** Epoch values below this are seconds, at or above it milliseconds. */
const FIRST_MS_EPOCH = 1e12;

const epochMs = (value: number): number => (value < FIRST_MS_EPOCH ? value * SECOND_MS : value);

const isoMs = (text: string | undefined): number | undefined => {
	const parsed = text === undefined ? Number.NaN : Date.parse(text);

	return Number.isNaN(parsed) ? undefined : parsed;
};

/** The reset time in a limit message, as epoch ms. Undefined when the message holds none this parser knows. */
export const parseLimit = (text: string): number | undefined => {
	const epoch = LIMIT_EPOCH.exec(text)?.[1];

	return epoch === undefined ? isoMs(LIMIT_ISO.exec(text)?.[1]) : epochMs(Number(epoch));
};

const isLimitRefusal = (t: Transcript, result: Result): boolean => result.is_error && (t.rejectedUntil !== undefined || LIMIT_TEXT.test(result.result));

const isLockError = (outcome: RunOutcome): boolean => outcome.kind === "finished" && outcome.isError && LOCK_TEXT.test(outcome.text);

const isUnauthorized = (finished: Finished): boolean => finished.isError && UNAUTHORIZED.test(finished.text);

const sumUsage = (result: Result, tokensOf: (usage: z.infer<typeof ModelUsage>) => number): number =>
	Object.values(result.modelUsage).reduce((sum, usage) => sum + tokensOf(usage), 0);

/** What the whole stream amounts to, once the process has ended. */
const endedAs = (t: Transcript, { sessionId, tokenCap, stderr }: { sessionId: string; tokenCap: number | undefined; stderr: string }): Ended => {
	const { result } = t;

	if (result === undefined) {
		return {
			kind: "finished",
			subtype: "no-result",
			isError: true,
			sessionId,
			text: stderr.trim().slice(-STDERR_TAIL),
			structured: undefined,
			tokens: 0,
			cacheReadTokens: 0,
			plugins: t.plugins,
			keySource: t.keySource,
		};
	}

	if (isLimitRefusal(t, result)) {
		const until = t.rejectedUntil ?? parseLimit(result.result);

		return until === undefined ? { kind: "limit-unparsed", text: result.result } : { kind: "limited", until };
	}

	const tokens = sumUsage(result, (usage) => billed(usage.inputTokens, usage.outputTokens, usage.cacheCreationInputTokens));

	if (isOverCap(tokens, tokenCap)) return { kind: "over-cap", tokens };

	return {
		kind: "finished",
		subtype: result.subtype,
		isError: result.is_error,
		sessionId: result.session_id ?? sessionId,
		text: result.result,
		structured: result.structured_output,
		tokens,
		cacheReadTokens: sumUsage(result, (usage) => usage.cacheReadInputTokens),
		plugins: t.plugins,
		keySource: t.keySource,
	};
};

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
	/** Called once, when the first model message arrives. */
	readonly onFirstToken?: () => void;
};

/** A runner whose start check has run. A runner that failed it holds every run with the card that says why. */
export type Runner = {
	readonly run: (request: RunRequest) => Promise<RunOutcome>;
	/** Epoch ms until which every run is held, or 0. */
	readonly limitedUntil: () => number;
};

export type RunnerOptions = {
	readonly state: Pick<State, "dir" | "faults" | "limit">;
	/** The model the start check runs on. */
	readonly model: string;
	readonly binary?: string;
	/** Added to the process environment. An API key in the environment is passed on untouched. */
	readonly env?: Readonly<Record<string, string>>;
	readonly now?: () => number;
	/** The first wait before a run that hit the refresh-lock error runs again; later waits grow from it. */
	readonly lockBackoffMs?: number;
};

/** A run that ended on the refresh-lock error, thrown so the retry runs it again. */
class LockHeld extends Error {
	override name = "LockHeld";

	constructor(readonly outcome: RunOutcome) {
		super("claude could not take the credentials refresh lock");
	}
}

const credentialOf = (keySource: string | undefined, env: Readonly<Record<string, string | undefined>>): string => {
	if (keySource !== undefined && keySource !== "none") return `api-key:${keySource}`;

	return env.CLAUDE_CODE_OAUTH_TOKEN ? "oauth-token" : "login";
};

const Credential = z.object({ credential: z.string() });

const readCredential = (file: string): string | undefined => {
	try {
		return Credential.parse(JSON.parse(readFileSync(file, "utf8"))).credential;
	} catch (error) {
		if (error instanceof Error && isMissing(error)) return undefined;

		throw error;
	}
};

/** The credential is recorded at the first start. A different one later shows one card, and runs go on. */
const recordCredential = (state: RunnerOptions["state"], credential: string): void => {
	const file = join(state.dir, CREDENTIALS);
	const recorded = readCredential(file);

	if (recorded === undefined) {
		mkdirSync(state.dir, { recursive: true });
		atomicWrite(file, `${JSON.stringify({ credential })}\n`);

		return;
	}

	if (recorded === credential) return state.faults.clear("credential-changed");

	state.faults.raise({
		code: "credential-changed",
		cause: `claude now runs on ${credential}; it was recorded as ${recorded}.`,
		fix: `Runs go on. Delete ${file} to record ${credential} as the choice.`,
	});
};

const START_PROMPT = 'Reply with the JSON {"ok":true}.';

const START_SCHEMA = {
	type: "object",
	properties: { ok: { type: "boolean" } },
	required: ["ok"],
};

const VERSION = /\d+\.\d+\.\d+/;

/** A version that is missing, unreadable or older than the floor starts no run. */
const isBelowFloor = (version: string | undefined): boolean => version === undefined || semver.valid(version) === null || semver.lt(version, CLAUDE_FLOOR);

type Started = { readonly check: RunOutcome; readonly runner: Runner };

/**
 * Runs `claude -p` as the owner's own unmodified `claude` binary, on their login, their plan token or an API key.
 * No run starts until the version floor and the start check pass; until then every run is held with one card.
 */
const startChecked = async (options: RunnerOptions): Promise<Started> => {
	const { state, binary = "claude", now = Date.now, lockBackoffMs = LOCK_BACKOFF_MS } = options;
	const env = { ...process.env, ...options.env };
	const limitedUntil = () => savedLimitUntil(state);

	const hold = (code: string, cause: string, fix: string): Extract<RunOutcome, { kind: "held" }> => ({
		kind: "held",
		card: state.faults.raise({ code, cause, fix }),
	});

	const held = (outcome: Extract<RunOutcome, { kind: "held" }>) => ({
		check: outcome,
		runner: { run: async () => outcome, limitedUntil },
	});

	/** One process, read line by line. The cap is checked on every streamed message, and the process is killed the moment it is passed. */
	const spawnRun = async ({ prompt, cwd, model, effort, schema, tokenCap, signal, onFirstToken }: RunRequest, sessionId: string): Promise<Ended> => {
		const stop = new AbortController();
		const logs = mkdtempSync(join(tmpdir(), "hum-claude-"));
		const stderrFile = join(logs, "stderr");
		const stderrFd = openSync(stderrFile, "w");

		try {
			const proc = x(binary, runArgs({ model, effort, schema, sessionId }), {
				stdin: prompt,
				signal: AbortSignal.any(signal ? [stop.signal, signal] : [stop.signal]),
				nodePath: false,
				// stderr goes to a file, so the line reader sees stdout alone: one stream cannot split another's line.
				nodeOptions: {
					cwd,
					env,
					killSignal: "SIGKILL",
					stdio: ["pipe", "pipe", stderrFd],
				},
			});

			// A process that ends before it reads its stdin breaks the pipe; what it said is read from its result.
			proc.process?.stdin?.on("error", () => {});

			let transcript = EMPTY_TRANSCRIPT;

			for await (const line of proc) {
				const next = readLine(transcript, line);

				if (hasFirstToken(next) && !hasFirstToken(transcript)) onFirstToken?.();

				transcript = next;

				if (isOverCap(spentSoFar(transcript), tokenCap)) {
					stop.abort();

					return { kind: "over-cap", tokens: spentSoFar(transcript) };
				}
			}

			return endedAs(transcript, {
				sessionId,
				tokenCap,
				stderr: readFileSync(stderrFile, "utf8"),
			});
		} catch (error) {
			return hold("claude-not-found", `claude could not start: ${error instanceof Error ? error.message : String(error)}`, "Install Claude Code and sign in.");
		} finally {
			closeSync(stderrFd);
			rmSync(logs, { recursive: true, force: true });
		}
	};

	/** The ended run, with a limit saved so no call is made before it ends, and an unreadable limit held with one card. */
	const settle = (ended: Ended): RunOutcome => {
		if (ended.kind === "limit-unparsed") {
			return hold(
				LIMIT_UNPARSED,
				`claude refused with a usage limit and no reset time hum can read: ${ended.text.slice(0, CARD_EXCERPT)}`,
				"Runs stay held. Tell hum's maintainer the message, or restart the worker once the limit has reset.",
			);
		}

		if (ended.kind === "limited")
			state.limit.put(LIMIT_KEY, {
				until: Math.max(limitedUntil(), ended.until),
			});

		return ended;
	};

	/** A refresh-lock error is retried with growing, jittered waits, each try on a new session id. */
	const attempt = (request: RunRequest): Promise<RunOutcome> =>
		pRetry(
			async (attemptNumber) => {
				const sessionId = attemptNumber === 1 ? (request.sessionId ?? randomUUID()) : randomUUID();

				request.onSession?.(sessionId);

				const outcome = settle(await spawnRun(request, sessionId));

				if (isLockError(outcome)) throw new LockHeld(outcome);

				return outcome;
			},
			{
				retries: LOCK_TRIES - 1,
				minTimeout: lockBackoffMs,
				randomize: true,
				shouldRetry: ({ error }) => error instanceof LockHeld,
			},
		).catch((error: Error) => {
			if (error instanceof LockHeld) return error.outcome;

			throw error;
		});

	const run = async (request: RunRequest): Promise<RunOutcome> => {
		if (now() < limitedUntil()) return { kind: "limited", until: limitedUntil() };

		const outcome = await attempt(request);

		if (outcome.kind !== "finished") return outcome;

		if (isUnauthorized(outcome)) return { kind: "held", card: rejectedToken(state.faults, outcome.text) };

		state.faults.clear("token-rejected");

		return outcome;
	};

	const version = await x(binary, ["--version"], {
		nodePath: false,
		nodeOptions: { env },
	}).then(
		({ stdout }) => VERSION.exec(stdout)?.[0],
		() => undefined,
	);

	if (isBelowFloor(version)) {
		return held(hold("claude-too-old", `Claude Code ${version ?? "was not found"}; hum was proven on ${CLAUDE_FLOOR} or later.`, "Update Claude Code: claude update."));
	}

	const check = await attempt({
		prompt: START_PROMPT,
		cwd: tmpdir(),
		model: options.model,
		effort: "low",
		schema: START_SCHEMA,
	});

	if (check.kind === "held") return held(check);

	if (check.kind === "limited") return { check, runner: { run: async () => check, limitedUntil } };

	if (check.kind !== "finished") return held(hold("start-check-failed", `The start check ended as ${check.kind}.`, "Run it again once the limit resets."));

	const hasPlugin = check.plugins.includes(REQUIRED_PLUGIN);

	if (!succeeded(check) || !hasPlugin) {
		return held(
			hold(
				"start-check-failed",
				`The start check returned ${check.subtype}${check.isError ? " with an error" : ""}${hasPlugin ? "" : ` and no ${REQUIRED_PLUGIN} plugin`}: ${check.text.slice(0, CARD_EXCERPT)}`,
				`Check that claude runs signed in (not in bare mode) and that the ${REQUIRED_PLUGIN} plugin is installed.`,
			),
		);
	}

	recordCredential(state, credentialOf(check.keySource, env));

	state.faults.clear(LIMIT_UNPARSED);

	return { check, runner: { run, limitedUntil } };
};

/** A start check that a usage limit refused says nothing about the install: it is made again once the limit has ended. */
const isUnsettled = ({ check }: Started): boolean => check.kind === "limited" || (check.kind === "held" && check.card.code === LIMIT_UNPARSED);

/**
 * A runner. Its start check is made again on the next run for as long as a usage limit refuses it, and a saved
 * limit that still stands defers the check, so no call is made before the limit ends and no restart is needed.
 */
export const startRunner = async (options: RunnerOptions): Promise<Started> => {
	const { state, now = Date.now } = options;
	const started = pMemoize(() => startChecked(options));

	const settle = async (): Promise<Started> => {
		const result = await started();

		if (isUnsettled(result)) pMemoizeClear(started);

		return result;
	};

	const isLimited = (): boolean => now() < savedLimitUntil(state);
	const limited = (): RunOutcome => ({ kind: "limited", until: savedLimitUntil(state) });

	const runner: Runner = {
		run: async (request) => (isLimited() ? limited() : (await settle()).runner.run(request)),
		limitedUntil: () => savedLimitUntil(state),
	};

	return { check: isLimited() ? limited() : (await settle()).check, runner };
};
