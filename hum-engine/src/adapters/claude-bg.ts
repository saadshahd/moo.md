import { mkdirSync, readFileSync, statSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import { x } from "tinyexec";
import { z } from "zod";
import type { HumConfig } from "../config/schema.ts";
import { listRecords, orMissing } from "../state/fs.ts";
import type { State } from "../state/open.ts";
import type { Card } from "../status/format.ts";
import { SECOND_MS } from "../time.ts";
import { CARD_EXCERPT, type Finished, type RunOutcome, type RunRequest, type Runner, type RunnerOptions, START_ANSWER, START_PROMPT, START_SCHEMA, startRunner, succeeded } from "./claude-p.ts";
import { billedTokens, cacheReadTokens, modelsOf, type RunTranscript, readTranscript } from "./transcript.ts";

/** The plugin a background run turns off, so no run draws the band or polls. */
export const HUM_PLUGIN = "hum@moo.md";

/** The hook events that tell the engine where a run's transcript is: at its first prompt and at each stop. */
const HOOK_EVENTS = ["UserPromptSubmit", "Stop"] as const;

/** `claude --bg` prints the id in colour, so the line is read after its terminal codes are dropped. */
const SHORT_ID = /backgrounded\W+([0-9a-f]{8})\b/u;

const AGENT_VIEW_KIND = "background";

const SINGLE_QUOTE = /'/g;

const shellQuote = (text: string): string => `'${text.replace(SINGLE_QUOTE, `'\\''`)}'`;

/** A hook command that saves the hook's input, which names the session and its transcript, as a file of its own. */
const dropInto = (folder: string): string => `cat > ${shellQuote(folder)}/$$.json`;

/** The settings every background run starts with: hum's plugin off, the deny rules and auto mode's rules, and a hook that reports the run. */
export const backgroundSettings = ({ deniedRunCommands, runAutoMode }: Pick<HumConfig, "deniedRunCommands" | "runAutoMode">, stopsFolder: string) => ({
	enabledPlugins: { [HUM_PLUGIN]: false },
	// A project's own settings may name an editor that waits for a window; a run has none, so its git would wait for good.
	env: { GIT_EDITOR: "true" },
	permissions: { deny: deniedRunCommands.map((command) => `Bash(${command} *)`) },
	autoMode: { classifyAllShell: true, environment: runAutoMode.environment, allow: runAutoMode.allow, hard_deny: runAutoMode.hardDeny },
	hooks: Object.fromEntries(HOOK_EVENTS.map((event) => [event, [{ hooks: [{ type: "command", command: dropInto(stopsFolder) }] }]])),
});

export type LaunchSpec = {
	readonly name: string;
	readonly model: string;
	readonly effort: string;
	readonly schema: object;
	readonly settings: object;
};

/** The flags of `claude --bg`. The prompt goes on stdin: a flag that takes a list swallows a prompt placed after it. */
export const launchArgs = ({ name, model, effort, schema, settings }: LaunchSpec): string[] => [
	"--bg",
	"-n",
	name,
	"--model",
	model,
	"--effort",
	effort,
	"--permission-mode",
	"auto",
	"--json-schema",
	JSON.stringify(schema),
	"--settings",
	JSON.stringify(settings),
];

const Listed = z.looseObject({ id: z.string().optional(), kind: z.string(), name: z.string().nullish(), sessionId: z.string(), state: z.string().nullish() });

type Agent = { readonly id: string; readonly name: string | null | undefined; readonly sessionId: string; readonly state: string | null | undefined };

const Reported = z.looseObject({ hook_event_name: z.string(), session_id: z.string(), transcript_path: z.string().optional() });

const STOP_EVENT = "Stop";

/** What the engine reads of a run at one moment. */
export type Reading = {
	readonly transcript: RunTranscript;
	/** Epoch ms of each hook file the run dropped. */
	readonly stops: readonly number[];
	/** The job's state in `claude agents --json`, or undefined once the run has left the list. */
	readonly job: string | undefined;
};

export type Progress =
	| { readonly kind: "waiting" }
	| { readonly kind: "over-cap"; readonly tokens: number }
	| { readonly kind: "done"; readonly structured: unknown }
	| { readonly kind: "failed"; readonly why: string };

const FAILED_STATE = "failed";

const ENDED_STATES = ["done", "stopped"];

/**
 * Where a run stands. Done is a `structured_output` attachment and then a `Stop`: under a schema the hook fires
 * twice, and only the second follows the attachment. Failed is the job's state or an API error row.
 */
export const progressOf = ({ transcript, stops, job }: Reading, tokenCap: number | undefined): Progress => {
	const tokens = billedTokens(transcript);

	if (tokenCap !== undefined && tokens > tokenCap) return { kind: "over-cap", tokens };

	const { structured } = transcript;

	if (structured !== undefined && stops.some((at) => at >= structured.at)) return { kind: "done", structured: structured.data };

	if (transcript.apiError !== undefined) return { kind: "failed", why: transcript.apiError };

	if (job === FAILED_STATE) return { kind: "failed", why: "the job's state is failed" };

	if (job !== undefined && ENDED_STATES.includes(job) && structured === undefined) return { kind: "failed", why: `the run ended as ${job} with no structured result` };

	// A run the owner stopped in agent view, or one that died, leaves the list with no result.
	if (job === undefined) return { kind: "failed", why: "the run left claude agents with no structured result" };

	return { kind: "waiting" };
};

const finishedOf = (sessionId: string, transcript: RunTranscript, { subtype, isError, text, structured }: Pick<Finished, "subtype" | "isError" | "text" | "structured">): Finished => ({
	kind: "finished",
	subtype,
	isError,
	sessionId,
	text,
	structured,
	tokens: billedTokens(transcript),
	cacheReadTokens: cacheReadTokens(transcript),
	plugins: [],
	keySource: undefined,
	models: modelsOf(transcript),
});

const succeededWith = (structured: Finished["structured"]): Pick<Finished, "subtype" | "isError" | "text" | "structured"> => ({ subtype: "success", isError: false, text: "", structured });

const failedWith = (why: string): Pick<Finished, "subtype" | "isError" | "text" | "structured"> => ({ subtype: "error_during_execution", isError: true, text: why, structured: undefined });

/** What `claude --bg` said: the id of the run it started, or why it did not start one. */
type Launched = { readonly kind: "started"; readonly id: string } | { readonly kind: "refused"; readonly why: string };

export const FALLBACK_CODE = "background-run-fell-back";

export type BackgroundOptions = Pick<RunnerOptions, "binary" | "env"> & {
	readonly state: Pick<State, "stops" | "faults">;
	readonly config: Pick<HumConfig, "deniedRunCommands" | "runAutoMode" | "backgroundPollSeconds" | "backgroundLaunchSeconds">;
	/** The runner for everything that is not a named agent run, and for the runs a missing background service cannot take. */
	readonly fallback: Runner;
};

/**
 * Runs a named agent run as a Claude Code background agent, so the owner sees it in agent view. The run's name is
 * saved before it launches: a run found under that name is adopted, never started twice. The engine reads the
 * transcript, enforces the token cap by `claude stop`, and stops and removes the run once its outcome is taken.
 * A cheap model call, a run with no name, and a run the background service cannot take go to `fallback`.
 */
export const backgroundRunner = ({ binary = "claude", env, state, config, fallback }: BackgroundOptions): Runner => {
	const pollMs = config.backgroundPollSeconds * SECOND_MS;

	const claude = (args: readonly string[], options: { stdin?: string; cwd?: string } = {}) =>
		x(binary, [...args], { stdin: options.stdin, nodePath: false, nodeOptions: { cwd: options.cwd, env: { ...process.env, ...env } } });

	const agents = async (): Promise<Agent[]> => {
		const { stdout } = await claude(["agents", "--json"]);
		const parsed = z.array(Listed).safeParse(JSON.parse(stdout));

		return parsed.success ? parsed.data.flatMap(({ kind, id, name, sessionId, state }) => (kind === AGENT_VIEW_KIND && id !== undefined ? [{ id, name, sessionId, state }] : [])) : [];
	};

	const reportsOf = (sessionId: string): { at: number; event: string; transcriptPath: string | undefined }[] =>
		listRecords(state.stops).flatMap((file) => {
			const reported = orMissing(() => Reported.safeParse(JSON.parse(readFileSync(file, "utf8"))), undefined);

			return reported?.success && reported.data.session_id === sessionId ? [{ at: statSync(file).mtimeMs, event: reported.data.hook_event_name, transcriptPath: reported.data.transcript_path }] : [];
		});

	const readRun = async (id: string, sessionId: string): Promise<Reading> => {
		// The job is read before the transcript: whatever put it in its state is already written.
		const job = (await agents()).find((agent) => agent.id === id)?.state ?? undefined;
		const reports = reportsOf(sessionId);
		const path = reports.find(({ transcriptPath }) => transcriptPath !== undefined)?.transcriptPath;
		const text = path === undefined ? "" : orMissing(() => readFileSync(path, "utf8"), "");

		return { transcript: readTranscript(text), stops: reports.filter(({ event }) => event === STOP_EVENT).map(({ at }) => at), job };
	};

	const end = async (id: string): Promise<void> => {
		await claude(["stop", id]);
		await claude(["rm", id]);
	};

	const launch = async (request: RunRequest & { name: string }): Promise<Launched> => {
		// The run's hook writes into this folder and does not make it.
		mkdirSync(state.stops, { recursive: true });

		const settings = backgroundSettings(config, state.stops);
		const { stdout, stderr } = await claude(launchArgs({ ...request, settings }), { stdin: request.prompt, cwd: request.cwd });
		const said = stripVTControlCharacters(`${stdout}\n${stderr}`).trim();
		const id = SHORT_ID.exec(said)?.[1];

		return id === undefined ? { kind: "refused", why: said.slice(0, CARD_EXCERPT) } : { kind: "started", id };
	};

	/** The run goes on as `claude -p`, which agent view does not list; the owner is told once, with the reason. */
	const fellBack = (request: RunRequest, why: string): Promise<RunOutcome> => {
		state.faults.raise({
			code: FALLBACK_CODE,
			cause: `claude --bg did not take "${request.name}" in ${request.cwd}: ${why}`,
			fix: "The run goes on as claude -p and is missing from agent view. A background run starts only in a folder of a repo whose trust the owner accepted.",
		});

		return fallback.run(request);
	};

	const listed = async (id: string, signal: AbortSignal | undefined): Promise<Agent | undefined> => {
		const until = Date.now() + config.backgroundLaunchSeconds * SECOND_MS;

		while (Date.now() < until && !signal?.aborted) {
			const found = (await agents()).find((agent) => agent.id === id);

			if (found) return found;

			await Bun.sleep(pollMs);
		}

		return undefined;
	};

	const watch = async (request: RunRequest, id: string, sessionId: string): Promise<RunOutcome> => {
		let announced = false;

		for (;;) {
			if (request.signal?.aborted) return { kind: "stopped" };

			const reading = await readRun(id, sessionId);

			if (!announced && Object.keys(reading.transcript.messages).length > 0) {
				announced = true;
				request.onFirstToken?.();
			}

			const progress = progressOf(reading, request.tokenCap);

			if (progress.kind === "over-cap") return progress;

			if (progress.kind === "done") return finishedOf(sessionId, reading.transcript, succeededWith(progress.structured));

			if (progress.kind === "failed") return finishedOf(sessionId, reading.transcript, failedWith(progress.why));

			await Bun.sleep(pollMs);
		}
	};

	const run = async (request: RunRequest): Promise<RunOutcome> => {
		const { name } = request;

		if (request.call === "judgment" || name === undefined) return fallback.run(request);

		const adopted = (await agents()).find((agent) => agent.name === name);
		const launched = adopted ? ({ kind: "started", id: adopted.id } as const) : await launch({ ...request, name });

		if (launched.kind === "refused") return fellBack(request, launched.why);

		const { id } = launched;
		const session = adopted ?? (await listed(id, request.signal));

		if (session === undefined) return request.signal?.aborted ? { kind: "stopped" } : fellBack(request, "the run never appeared in claude agents");

		state.faults.clear(FALLBACK_CODE);

		request.onSession?.(session.sessionId);

		try {
			return await watch(request, id, session.sessionId);
		} finally {
			await end(id);
		}
	};

	return { run, limitedUntil: fallback.limitedUntil };
};

const START_NAME = "hum start check";

export const BACKGROUND_CHECK_CODE = "background-start-check-failed";

export type StartedBackground = { readonly check: RunOutcome; readonly runner: Runner };

export type BackgroundStartOptions = Omit<RunnerOptions, "state"> &
	Pick<BackgroundOptions, "config" | "state"> & {
		readonly state: RunnerOptions["state"];
		/** The owner's repo: a background run starts only in a trusted folder, and a git repo of its own is not one. */
		readonly repo: string;
	};

const isOk = (outcome: RunOutcome): boolean => outcome.kind === "finished" && succeeded(outcome) && START_ANSWER.safeParse(outcome.structured).success;

const startCheckFault = (repo: string, why: string) => ({
	code: BACKGROUND_CHECK_CODE,
	cause: `A background run in ${repo} left no structured result: ${why}.`,
	fix: `Runs go on as claude -p and are missing from agent view. Run claude in ${repo} once and accept its trust prompt, then restart the worker.`,
});

const refusalCard = ({ faults }: Pick<BackgroundOptions, "state">["state"]): Card => {
	const card = faults.list().find(({ code }) => code === FALLBACK_CODE);

	if (!card) throw new Error("the fall-back ran without raising its card");

	return card;
};

const whyNot = (outcome: RunOutcome): string => {
	if (outcome.kind === "finished") return outcome.text.slice(0, CARD_EXCERPT);

	return outcome.kind === "held" ? outcome.card.cause : outcome.kind;
};

/**
 * The runner for the Mac: the `claude -p` runner, with named agent runs taken by the background service. Its start
 * check also starts one background run with the exact flags, which must leave a `structured_output` attachment.
 * The check may not fall back to `claude -p`: when it fails, one card says why and every run goes on as `claude -p`,
 * missing from agent view.
 */
export const startBackgroundRunner = async (options: BackgroundStartOptions): Promise<StartedBackground> => {
	const { config, repo, state, binary, env } = options;
	const started = await startRunner(options);

	if (started.check.kind !== "finished") return started;

	// The check's own fall-back holds with the card that says why the service refused.
	const refuse: Runner = { run: async () => ({ kind: "held", card: refusalCard(state) }), limitedUntil: started.runner.limitedUntil };
	const checker = backgroundRunner({ binary, env, state, config, fallback: refuse });
	const check = await checker.run({ name: START_NAME, prompt: START_PROMPT, cwd: repo, model: options.model, effort: "low", schema: START_SCHEMA });

	if (isOk(check)) {
		state.faults.clear(BACKGROUND_CHECK_CODE);

		return { check, runner: backgroundRunner({ binary, env, state, config, fallback: started.runner }) };
	}

	// The start check's card says why for every run, so the card for the check's own fall-back would only repeat it.
const why = whyNot(check);

	state.faults.clear(FALLBACK_CODE);
	state.faults.raise(startCheckFault(repo, why));

	return { check, runner: started.runner };
};
