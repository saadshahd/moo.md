import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { ItemRef } from "../adapter-api.ts";
import type { HumConfig } from "../config/schema.ts";
import type { Json } from "../config/json.ts";
import { commandTimeoutMs, type Env, shellQuote } from "../exec.ts";
import { atomicWrite, listFiles, orMissing, slug } from "../state/fs.ts";
import type { State } from "../state/open.ts";
import { SECOND_MS } from "../time.ts";
import { type RunOutcome, type RunRequest, type Runner } from "./claude-p.ts";
import { gitIn } from "./git.ts";
import { failedWith, finishedOf, hookReports, runSettings, STOP_EVENT, succeededWith, tokensOf } from "./hooked-run.ts";
import { limitOf, savedLimitUntil, settleLimit } from "./limit.ts";
import { HUM_EXT, type RoundupCall, type RoundupClient, RoundupRefusal, roundupRpc } from "./roundup-rpc.ts";
import { keepSchema, ROWS_DIR, type RunFolder, runFolder, runFolderAt, runKey, takeAnswer } from "./run-answer.ts";
import { readTranscript, type RunTranscript } from "./transcript.ts";

const RailNode = z.looseObject({
	id: z.string(),
	name: z.string(),
	kind: z.string(),
	parent: z.string().nullable().optional(),
	status: z.looseObject({ kind: z.string() }).nullish(),
});

type RailNode = z.infer<typeof RailNode>;

const ProgramRun = z.looseObject({ state: z.string(), terminalId: z.string().optional() });

const RowRecord = z.strictObject({ id: z.string(), name: z.string() });

/** hum's note to a row, with how many turns the row had ended when hum sent it. */
const NotedMark = z.strictObject({ stops: z.number() });

/** The longest name roundup gives a Rail row. */
const RAIL_NAME_LENGTH = 42;

/** Hex characters of the hash that keeps two long names apart once each is cut to fit. */
const NAME_HASH = 8;

/** A row's status once it has ended, whoever ended it. */
const ENDED = "done";

const IDLE = "idle";

const WORKSTREAM = "workstream";

/** A run whose row ended, or that hum stopped, without an answer hum took. */
export const ROW_STOPPED = "stopped";

/** The card for a Project whose roundup runs hum outside its program, so runs are not Rail rows. */
export const NOT_PROGRAM_CODE = "rows-not-program";

/** The card for a row roundup would not start. */
export const ROW_REFUSED_CODE = "row-refused";

/** What roundup answers a program whose entry names no folder to adopt worktrees in. */
const NO_ADOPT_FOLDER = /outside_program_directory/u;

/** Run names past this length are cut and hashed to fit a Rail row. */
export const railName = (name: string): string => (name.length <= RAIL_NAME_LENGTH ? name : `${name.slice(0, RAIL_NAME_LENGTH - NAME_HASH - 1)} ${slug(name).slice(0, NAME_HASH)}`);

/** The Workstream an item's rows sit in, "#<id> <title>". */
export const itemWorkstreamName = ({ id, title }: ItemRef): string => railName(`#${id} ${title}`);

/** The command a row pipes its answer to: this hum's own, so the answer reaches the engine that started the row. */
const RUN_ANSWER = [process.execPath, fileURLToPath(new URL("../cli/main.ts", import.meta.url)), "run-answer"].map(shellQuote).join(" ");

/** The Pad that carries a run's prompt to its row, since a row's order holds only a short ask. */
const briefName = (name: string): string => railName(`${name} brief`);

const briefOf = ({ prompt, schema }: Pick<RunRequest, "prompt" | "schema">): string =>
	[
		prompt,
		"## Your answer",
		`When you are done, pipe your answer, one JSON value that matches the schema below, to \`${RUN_ANSWER}\`. It prints \`answer saved\` once hum has it, or what to fix: fix the answer and pipe it again until it prints \`answer saved\`, then end your turn.`,
		`\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``,
	].join("\n\n");

const orderOf = (name: string): Json => ({
	kind: "work",
	title: railName(name),
	ask: `Do the work the Pad "${briefName(name)}" holds, then hand hum your answer as it says.`,
	done: "hum's answer command printed `answer saved` for your answer.",
	limits: ["Hand your answer to hum only through its answer command.", "Make no Todo."],
});

/** What a row may not do beyond every run's rules: make a Todo, which hum would read as new work. */
const ROW_DENY = ["mcp__roundup__todo_create", "Bash(rup todo create *)"];

/** A row's settings: every run's, auto mode, which the row starts in, the denials above, and what `hum run-answer` reads. */
const rowSettings = (config: RowsOptions["config"], folder: RunFolder, env: Readonly<Record<string, string>>): Json => {
	const settings = runSettings(config, folder.hooks, env);

	return { ...settings, permissions: { defaultMode: "auto", deny: [...settings.permissions.deny, ...ROW_DENY] } };
};

export type RowsOptions = {
	readonly call: RoundupCall;
	readonly state: Pick<State, "dir" | "faults" | "limit">;
	readonly config: Pick<HumConfig, "deniedRunCommands" | "runAutoMode" | "backgroundPollSeconds" | "rowNoteWaitSeconds" | "commandTimeoutSeconds">;
	/** The runner for a cheap model call and a run with no name. */
	readonly fallback: Runner;
	readonly now: () => number;
};

/** What hum reads of a run's row at one moment. */
type Reading = { readonly node: RailNode | undefined; readonly transcript: RunTranscript; readonly sessionId: string | undefined; readonly stops: number };

/**
 * Runs each named agent run as a Rail row, an Agent roundup starts in the run's slot under the item's Workstream, so
 * the owner sees it, its diff and its questions. The run's prompt rides in a Pad, and its answer comes back through
 * `hum run-answer`, which counts only under the run's key. A row found alive under the run's name is taken over, never
 * started twice, and one hum stops on its way out is left running for the next hum to take over. A row that ends a turn with no answer gets one note; a second such turn, or no new turn within the
 * configured wait, stops it and fails the run. A cheap model call and a run with no name go to `fallback`.
 */
export const railRunner = ({ call, state, config, fallback, now }: RowsOptions): Runner => {
	const pollMs = config.backgroundPollSeconds * SECOND_MS;
	const noteWaitMs = config.rowNoteWaitSeconds * SECOND_MS;

	const tree = async (): Promise<RailNode[]> => z.array(RailNode).parse(await call("rail.tree"));

	const workstreamOf = async (item: ItemRef): Promise<string> => {
		const name = itemWorkstreamName(item);
		const found = (await tree()).find((node) => node.kind === WORKSTREAM && node.name === name);

		return found?.id ?? RailNode.parse(await call("rail.createWorkstream", { name })).id;
	};

	/** The live row of a run: the one its folder records, else one of its name in the item's Workstream, as after a crash between start and record. */
	const liveRow = async (folder: RunFolder, name: string, workstream: string): Promise<string | undefined> => {
		const recorded = orMissing(() => RowRecord.parse(JSON.parse(readFileSync(folder.row, "utf8"))).id, undefined);
		const live = (await tree()).filter((node) => node.status?.kind !== ENDED);

		return live.find((node) => node.id === recorded)?.id ?? live.find((node) => node.parent === workstream && node.name === railName(name))?.id;
	};

	const writeBrief = async (name: string, request: RunRequest, workstream: string): Promise<void> => {
		const pad = briefName(name);
		const text = briefOf(request);

		await call("pad.create", { name: pad, text, visibility: "internal" }).catch(async (error: Error) => {
			if (!(error instanceof RoundupRefusal)) throw error;

			await call("pad.write", { name: pad, text });
		});
		await call("pad.move", { name: pad, home: workstream });
	};

	/** Adopts the run's slot as a row. Settings carry the run's key, so they reach no Pad, Message, argv or order. */
	const startRow = async (name: string, folder: RunFolder, request: RunRequest, workstream: string): Promise<string> => {
		await writeBrief(name, request, workstream);

		const env = { ...request.env, HUM_RUN: name, HUM_RUN_KEY: runKey(state.dir, name), HUM_RUN_DIR: folder.root };
		const branch = (await gitIn(request.cwd, { timeoutMs: commandTimeoutMs(config) }).raw(["rev-parse", "--abbrev-ref", "HEAD"])).trim();

		const node = RailNode.parse(
			await call("agent.adopt", { path: request.cwd, branch, parent: workstream, order: orderOf(name), model: request.model, effort: request.effort, settings: rowSettings(config, folder, env), visibility: "internal" }),
		);

		atomicWrite(folder.row, JSON.stringify({ id: node.id, name }));
		await call("rail.rename", { id: node.id, name: railName(name) });

		return node.id;
	};

	const stop = async (row: string): Promise<void> => {
		await call("agent.stop", { id: row }).catch((error: Error) => {
			if (!(error instanceof RoundupRefusal)) throw error;
		});
	};

	const readRow = async (row: string, folder: RunFolder): Promise<Reading> => {
		const reports = hookReports(folder.hooks);
		const path = reports.find(({ transcriptPath }) => transcriptPath !== undefined)?.transcriptPath;
		const text = path === undefined ? "" : orMissing(() => readFileSync(path, "utf8"), "");

		return {
			node: (await tree()).find((node) => node.id === row),
			transcript: readTranscript(text),
			sessionId: reports[0]?.sessionId,
			stops: reports.filter(({ event }) => event === STOP_EVENT).length,
		};
	};

	/** The note hum sent the row, if any: kept in the run's folder, so a hum that takes the row over sends no second one. */
	const noted = (folder: RunFolder): { readonly at: number; readonly stops: number } | undefined =>
		orMissing(() => ({ at: statSync(folder.noted).mtimeMs, ...NotedMark.parse(JSON.parse(readFileSync(folder.noted, "utf8"))) }), undefined);

	const note = async (row: string, name: string, folder: RunFolder, stops: number): Promise<void> => {
		await call("message.send", { to: row, kind: "note", body: `hum has no answer from you yet. Hand it over as the Pad "${briefName(name)}" says: pipe it to hum's answer command until it prints \`answer saved\`.` });
		atomicWrite(folder.noted, JSON.stringify({ stops }));
	};

	const watch = async (request: RunRequest, name: string, row: string, folder: RunFolder): Promise<RunOutcome> => {
		const key = runKey(state.dir, name);
		let session: string | undefined;
		let announced = false;

		const ended = (reading: Reading, why: string): RunOutcome => finishedOf(reading.sessionId, reading.transcript, failedWith(why, ROW_STOPPED));

		for (;;) {
			/* hum itself stops here, as when it shuts down: the row and its folder stay, so the next hum takes the row over. */
			if (request.signal?.aborted) return { kind: "stopped" };

			const answer = takeAnswer(folder, key, name);
			const reading = await readRow(row, folder);

			if (session === undefined && reading.sessionId !== undefined) request.onSession?.((session = reading.sessionId));

			if (!announced && Object.keys(reading.transcript.messages).length > 0) {
				announced = true;
				request.onFirstToken?.();
			}

			if (answer !== undefined) {
				await stop(row);

				return finishedOf(reading.sessionId, reading.transcript, succeededWith(answer));
			}

			if (reading.node === undefined || reading.node.status?.kind === ENDED) {
				const late = takeAnswer(folder, key, name);

				return late === undefined ? ended(reading, `the row "${railName(name)}" ended before it answered`) : finishedOf(reading.sessionId, reading.transcript, succeededWith(late));
			}

			const tokens = tokensOf(reading.transcript);

			if (request.tokenCap !== undefined && tokens > request.tokenCap) {
				await stop(row);

				return { kind: "over-cap", tokens };
			}

			if (reading.transcript.limit !== undefined) {
				await stop(row);

				return settleLimit(state, limitOf(reading.transcript.limit.text, reading.transcript.limit.resetsAt));
			}

			if (reading.transcript.apiError !== undefined) {
				await stop(row);

				return ended(reading, reading.transcript.apiError);
			}

			const mark = noted(folder);

			if (mark === undefined && reading.stops > 0) await note(row, name, folder, reading.stops);

			if (mark !== undefined && reading.stops > mark.stops) {
				await stop(row);

				return ended(reading, `the row "${railName(name)}" ended a turn after hum's note with no answer`);
			}

			if (mark !== undefined && reading.node.status?.kind === IDLE && now() - mark.at > noteWaitMs) {
				await stop(row);

				return ended(reading, `the row "${railName(name)}" stayed idle ${config.rowNoteWaitSeconds} seconds after hum's note with no answer`);
			}

			await Bun.sleep(pollMs);
		}
	};

	/** A refusal to start a row, held with one card that names roundup's words and the fix. */
	const refused = (error: RoundupRefusal): RunOutcome => ({
		kind: "held",
		card: state.faults.raise({
			code: ROW_REFUSED_CODE,
			cause: `roundup refused hum's run: ${error.message}`,
			fix: NO_ADOPT_FOLDER.test(error.message)
				? "In roundup's Settings for this Project, set the Program's adopt folder to .hum-slots, then start the Program again."
				: "hum serve must run as this Project's Program in roundup's Settings, so roundup takes its runs' settings; start the Program again there.",
		}),
	});

	const run = async (request: RunRequest): Promise<RunOutcome> => {
		const { name, item } = request;

		if (request.call === "judgment" || name === undefined) return fallback.run(request);

		if (item === undefined) throw new Error(`the run "${name}" names no item, and a Rail row sits in its item's Workstream`);

		if (now() < savedLimitUntil(state)) return { kind: "limited", until: savedLimitUntil(state) };

		const folder = runFolder(state.dir, name);

		keepSchema(folder, request);
		/* The row's hooks write into this folder and do not make it. */
		mkdirSync(folder.hooks, { recursive: true });

		try {
			const workstream = await workstreamOf(item);
			const row = (await liveRow(folder, name, workstream)) ?? (await startRow(name, folder, request, workstream));

			state.faults.clear({ code: ROW_REFUSED_CODE });

			const outcome = await watch(request, name, row, folder);

			if (outcome.kind !== "stopped") rmSync(folder.root, { recursive: true, force: true });

			return outcome;
		} catch (error) {
			if (error instanceof RoundupRefusal) return refused(error);

			throw error;
		}
	};

	/** The names of the runs whose rows are alive. */
	const liveRuns = async (): Promise<ReadonlySet<string>> => {
		const live = new Set((await tree()).filter((node) => node.status?.kind !== ENDED).map(({ id }) => id));
		const rows = listFiles(`${state.dir}/${ROWS_DIR}`).flatMap((root) => orMissing(() => [RowRecord.parse(JSON.parse(readFileSync(runFolderAt(root).row, "utf8")))], []));

		return new Set(rows.filter(({ id }) => live.has(id)).map(({ name }) => name));
	};

	return { run, limitedUntil: fallback.limitedUntil, liveRuns };
};

/**
 * The roundup client of a hum that runs as its Project's program, as roundup names it: the Terminal roundup started
 * the program in is the one this process inherited. Under roundup but not as its program, one card says runs are not
 * rows and why. Outside roundup, or where its socket no longer answers, as in a shell left from an earlier start, nothing.
 */
export const roundupProgram = async (env: Env, faults: State["faults"]): Promise<RoundupClient | undefined> => {
	if (env.RUPD_SOCKET === undefined) return undefined;

	const client = roundupRpc(env.RUPD_SOCKET);

	const run = await client.call("project.programRun").then(
		(answer) => ProgramRun.parse(answer),
		(error: Error) => {
			if (error instanceof RoundupRefusal) throw error;

			return undefined;
		},
	);

	if (run === undefined) {
		client.close();

		return undefined;
	}

	if (run.state === "running" && run.terminalId !== undefined && run.terminalId === env.ROUNDUP_TERMINAL) {
		faults.clear({ code: NOT_PROGRAM_CODE });

		return client;
	}

	client.close();
	faults.raise({
		code: NOT_PROGRAM_CODE,
		cause: `roundup serves this Project, and this hum is not its Program, so runs are not Rail rows (it acts as ${HUM_EXT} there).`,
		fix: "In roundup's Settings for this Project, set the Program's command to hum serve and its adopt folder to .hum-slots, then start it there.",
	});

	return undefined;
};
