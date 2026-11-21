import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { HumConfig } from "../config/schema.ts";
import type { Json } from "../config/json.ts";
import { commandTimeoutMs, type Env, shellQuote } from "../exec.ts";
import { atomicWrite, orMissing } from "../state/fs.ts";
import type { State } from "../state/open.ts";
import { PROGRAM_FIX, readProgram } from "../service/program.ts";
import { SECOND_MS } from "../time.ts";
import { type RunOutcome, type RunRequest, type Runner } from "./claude-p.ts";
import { gitIn } from "./git.ts";
import { failedWith, finishedOf, hookReports, runSettings, STOP_EVENT, succeededWith, tokensOf } from "./hooked-run.ts";
import { limitOf, savedLimitUntil, settleLimit } from "./limit.ts";
import { itemWorkstream, NEEDS_YOU, RailNode, railName, railTree } from "./rail.ts";
import { HUM_EXT, type RoundupCall, type RoundupClient, RoundupRefusal } from "./roundup-rpc.ts";
import { askedSince, keepSchema, markAsked, type RunFolder, runFolder, runFolders, runKey, takeAnswer } from "./run-answer.ts";
import { readTranscript, type RunTranscript } from "./transcript.ts";

const RowRecord = z.strictObject({ id: z.string(), name: z.string() });

/** hum's note to a row, with how many turns the row had ended when hum sent it. */
const NotedMark = z.strictObject({ stops: z.number() });

/** A row's status once it has ended, whoever ended it. */
const ENDED = "done";

const IDLE = "idle";

/** A run whose row ended, or that hum stopped, without an answer hum took. */
export const ROW_STOPPED = "stopped";

/** The card for a Project whose roundup runs hum outside its program, so runs are not Rail rows. */
export const NOT_PROGRAM_CODE = "rows-not-program";

/** The card for a row roundup would not start. */
export const ROW_REFUSED_CODE = "row-refused";

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

/** A row's settings: every run's, hum's exact model, auto mode, which the row starts in, the denials above, and what `hum run-answer` reads. */
const rowSettings = (config: RowConfig, folder: RunFolder, env: Readonly<Record<string, string>>, model: string): Json => {
	const settings = runSettings(config, folder.hooks, env);

	return { ...settings, model, permissions: { defaultMode: "auto", deny: [...settings.permissions.deny, ...ROW_DENY] } };
};

/** What starting a row reads of the owner's config: every run's rules, and how long a git command may take. */
export type RowConfig = Pick<HumConfig, "deniedRunCommands" | "runAutoMode" | "commandTimeoutSeconds">;

/** One row to start, under its item's Workstream. */
export type RowStart = {
	readonly name: string;
	readonly folder: RunFolder;
	readonly request: Pick<RunRequest, "prompt" | "schema" | "cwd" | "model" | "effort" | "env" | "talk">;
	readonly workstream: string;
	/** The row adopts its run's slot; a row that changes no file starts in the Project's own folder instead. */
	readonly adopt: boolean;
};

const writeBrief = async (call: RoundupCall, name: string, request: RowStart["request"], workstream: string): Promise<void> => {
	const pad = briefName(name);
	const text = briefOf(request);

	await call("pad.create", { name: pad, text, visibility: "internal" }).catch(async (error: Error) => {
		if (!(error instanceof RoundupRefusal)) throw error;

		await call("pad.write", { name: pad, text });
	});
	await call("pad.move", { name: pad, home: workstream });
};

/** Where a row starts: its run's slot, on the branch the slot holds, or the Project's folder. */
const placeOf = async (config: RowConfig, { request: { cwd }, name, adopt }: RowStart): Promise<{ readonly method: string; readonly params: Record<string, Json> }> =>
	adopt
		? { method: "agent.adopt", params: { path: cwd, branch: (await gitIn(cwd, { timeoutMs: commandTimeoutMs(config) }).raw(["rev-parse", "--abbrev-ref", "HEAD"])).trim() } }
		: { method: "agent.spawn", params: { cwd, name: railName(name) } };

const ModelList = z.looseObject({ models: z.array(z.looseObject({ id: z.string() })) });

const ProjectModels = z.looseObject({ models: z.looseObject({ roles: z.array(z.looseObject({ role: z.string(), model: z.string().nullish() })) }) });

/** The role roundup starts a row under: a model the Project names for it replaces the one a row's settings carry. */
const ROW_ROLE = "subagent";

/**
 * The model roundup launches a row on. hum's exact model id rides in the row's settings, and roundup passes a model of
 * its own only where the Project names one for the row's role; there the name roundup lists that hum's id names goes
 * in its place, as "claude-haiku-5-5" names "haiku", and an id that names none is refused.
 */
const launchModel = async (call: RoundupCall, model: string): Promise<string | null> => {
	if (!ProjectModels.parse(await call("project.get")).models.roles.some((role) => role.role === ROW_ROLE && role.model)) return null;

	const words = new Set(model.split(/[^a-z0-9]+/i));
	const listed = ModelList.parse(await call("models.list")).models.map(({ id }) => id);
	const named = listed.find((id) => id === model || words.has(id));

	if (named === undefined) throw new Error(`roundup's Project names a model for its Agents, which would replace hum's ${model}, and ${model} names none of roundup's ${listed.join(", ")}: clear that model in roundup's Settings, or set hum.json models to ids that name one`);

	return named;
};

/**
 * Starts a row and records it in its run's folder. Settings carry the run's key, so they reach no Pad, Message, argv or
 * order. A row the owner talks to is shown from its start; every other row starts folded.
 */
export const startRow = async (call: RoundupCall, { stateDir, config }: { readonly stateDir: string; readonly config: RowConfig }, start: RowStart): Promise<RailNode> => {
	const { name, folder, request, workstream } = start;

	await writeBrief(call, name, request, workstream);

	const env = { ...request.env, HUM_RUN: name, HUM_RUN_KEY: runKey(stateDir, name), HUM_RUN_DIR: folder.root };
	const place = await placeOf(config, start);

	const node = RailNode.parse(await call(place.method, { ...place.params, parent: workstream, order: orderOf(name), model: await launchModel(call, request.model), effort: request.effort, settings: rowSettings(config, folder, env, request.model), visibility: request.talk === true ? "shown" : "internal" }));

	atomicWrite(folder.row, JSON.stringify({ id: node.id, name }));
	await call("rail.rename", { id: node.id, name: railName(name) });

	return node;
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
 * configured wait, stops it and fails the run. A run the owner talks to starts shown, in the run's working copy
 * without adopting it, so several such rows run there side by side; it gets no note, since it waits on the owner
 * through its turns, and its answer counts only once roundup showed the row waiting on the owner. A cheap model call
 * and a run with no name go to `fallback`.
 */
export const railRunner = ({ call, state, config, fallback, now }: RowsOptions): Runner => {
	const pollMs = config.backgroundPollSeconds * SECOND_MS;
	const noteWaitMs = config.rowNoteWaitSeconds * SECOND_MS;

	const tree = (): Promise<RailNode[]> => railTree(call);

	/** The live row of a run: the one its folder records, else one of its name in the item's Workstream, as after a crash between start and record. */
	const liveRow = async (folder: RunFolder, name: string, workstream: string): Promise<string | undefined> => {
		const recorded = orMissing(() => RowRecord.parse(JSON.parse(readFileSync(folder.row, "utf8"))).id, undefined);
		const live = (await tree()).filter((node) => node.status?.kind !== ENDED);

		return live.find((node) => node.id === recorded)?.id ?? live.find((node) => node.parent === workstream && node.name === railName(name))?.id;
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
		const talks = request.talk === true;
		let session: string | undefined;
		let announced = false;

		/** The answer the row saved; a row the owner talks to counts only one saved once roundup showed it waiting on the owner. */
		const answerAt = (node: RailNode | undefined): Json | undefined => {
			if (!talks) return takeAnswer(folder, key, name);

			if (node?.status?.kind === NEEDS_YOU) markAsked(folder, node.status.since ?? now());

			const since = askedSince(folder);

			return since === undefined ? undefined : takeAnswer(folder, key, name, since);
		};

		const ended = (reading: Reading, why: string): RunOutcome => finishedOf(reading.sessionId, reading.transcript, failedWith(why, ROW_STOPPED));

		for (;;) {
			/* hum itself stops here, as when it shuts down: the row and its folder stay, so the next hum takes the row over. */
			if (request.signal?.aborted) return { kind: "stopped" };

			const reading = await readRow(row, folder);
			const answer = answerAt(reading.node);

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
				const late = answerAt(reading.node);

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

			const mark = talks ? undefined : noted(folder);

			if (!talks && mark === undefined && reading.stops > 0) await note(row, name, folder, reading.stops);

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
			fix: PROGRAM_FIX,
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
			const workstream = await itemWorkstream(call, item);
			const row = (await liveRow(folder, name, workstream)) ?? (await startRow(call, { stateDir: state.dir, config }, { name, folder, request, workstream, adopt: request.talk !== true })).id;

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
		const rows = runFolders(state.dir).flatMap(({ row }) => orMissing(() => [RowRecord.parse(JSON.parse(readFileSync(row, "utf8")))], []));

		return new Set(rows.filter(({ id }) => live.has(id)).map(({ name }) => name));
	};

	return { run, limitedUntil: fallback.limitedUntil, liveRuns, talks: true };
};

/**
 * The roundup client of a hum that runs as its Project's program, as roundup names it: the Terminal roundup started
 * the program in is the one this process inherited. Under roundup but not as its program, one card says runs are not
 * rows and why. Outside roundup, or where its socket no longer answers, nothing.
 */
export const roundupProgram = async (env: Env, faults: State["faults"]): Promise<RoundupClient | undefined> => {
	const program = await readProgram(env);

	if (program === undefined) return undefined;

	if (program.isThisProcess) {
		faults.clear({ code: NOT_PROGRAM_CODE });

		return program.client;
	}

	program.client.close();
	faults.raise({
		code: NOT_PROGRAM_CODE,
		cause: `roundup serves this Project, and this hum is not its Program, so runs are not Rail rows (it acts as ${HUM_EXT} there).`,
		fix: PROGRAM_FIX,
	});

	return undefined;
};
