import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { z } from "zod";
import type { HumConfig } from "../config/schema.ts";
import type { Json } from "../config/json.ts";
import { installedCli } from "../engine.ts";
import { commandTimeoutMs, type Env, shellQuote } from "../exec.ts";
import { atomicWrite, dropInto, orMissing } from "../state/fs.ts";
import type { State } from "../state/open.ts";
import { PROGRAM_FIX, readProgram } from "../service/program.ts";
import { SECOND_MS } from "../time.ts";
import { type RunOutcome, type RunRequest, type Runner } from "./claude-p.ts";
import { gitIn } from "./git.ts";
import { answerHooks, failedWith, finishedOf, hookReports, runSettings, STOP_EVENT, succeededWith, tokensOf } from "./hooked-run.ts";
import { type LimitEnded, limitOf, savedLimitUntil, settleLimit } from "./limit.ts";
import { ENDED, itemWorkstream, NEEDS_YOU, RailNode, railName, railTree } from "./rail.ts";
import { HUM_EXT, type RoundupCall, type RoundupClient, RoundupRefusal } from "./roundup-rpc.ts";
import { askedSince, dropAnswers, hasSavedAnswer, keepSchema, keepTalkRun, markAsked, type RunFolder, runFolder, runFolders, runKey, takeAnswer, talkRunOf } from "./run-answer.ts";
import { readTranscript, type RunTranscript } from "./transcript.ts";

const RowRecord = z.strictObject({ id: z.string(), name: z.string() });

/** hum's note to a row, with how many turns the row had ended when hum sent it. */
const NotedMark = z.strictObject({ stops: z.number() });

const IDLE = "idle";

/** A run whose row ended, or that hum stopped, without an answer hum took. */
export const ROW_STOPPED = "stopped";

/** The card for a Project whose roundup runs hum outside its program, so runs are not Rail rows. */
export const NOT_PROGRAM_CODE = "rows-not-program";

/** The card for a row roundup would not start. */
export const ROW_REFUSED_CODE = "row-refused";

/** roundup's JSON-RPC code for a call only the Project's Program may make. */
const FORBIDDEN = -32002;

/** What a refusal roundup names means for hum's run, in plain words, and what the owner does about it. */
type RefusalReading = { readonly means?: string; readonly fix: string };

const NOT_PROGRAM: RefusalReading = { means: "roundup does not take this hum for the Project's Program", fix: PROGRAM_FIX };

const UNREAD: RefusalReading = { fix: "Change what roundup names; hum starts the row at the item's next pass." };

const REFUSALS = new Map<string, RefusalReading>(
	Object.entries({
		outside_program_directory: { means: "the run's folder lies outside the Worktree path the Program names", fix: PROGRAM_FIX },
		worktree_in_use: { means: "another Agent works in the run's folder", fix: "Stop that Agent on roundup's Rail; hum starts the row at the item's next pass." },
		detached_head: { means: "the run's folder holds no branch", fix: "Check out the branch hum made in that folder; hum starts the row at the item's next pass." },
		adopt_stale: { means: "the run's folder left the branch hum made there", fix: "Check that branch out in the folder again; hum starts the row at the item's next pass." },
		cwd_not_in_worktree: { means: "this hum starts a row outside a worktree, which roundup's Worktrees refuse", fix: "Update hum, or turn Worktrees off in roundup's Project settings." },
	}),
);

/**
 * The card for a row roundup refused: the cause says what roundup's reason means and keeps its words, and the fix is
 * to set the Program again only where roundup does not take hum for it or the folder lies outside its Worktree path.
 */
export const refusalCard = (refusal: RoundupRefusal) => {
	const { means, fix } = refusal.code === FORBIDDEN ? NOT_PROGRAM : (REFUSALS.get(refusal.reason ?? "") ?? UNREAD);

	return { cause: `roundup refused hum's run${means === undefined ? "" : `, as ${means}`}: ${refusal.message}`, fix };
};

/** The command a row pipes its answer to: the engine `repo` installs, so a row that outlives an update answers the engine that runs after it. */
const runAnswerCommand = (repo: string): string => [process.execPath, installedCli(repo), "run-answer"].map(shellQuote).join(" ");

/** The Pad that carries a run's prompt to its row, since a row's order holds only a short ask. */
const briefName = (name: string): string => railName(`${name} brief`);

/**
 * How a row hands hum its answer: piped to `hum run-answer` as one JSON value its schema takes, or as the owner's
 * answer to the question it asks with AskUserQuestion, which its answer hook reports.
 */
export type RowAnswer = { readonly by: "pipe"; readonly schema: object } | { readonly by: "question" };

const briefOf = (prompt: string, answer: RowAnswer, repo: string): string =>
	answer.by === "question"
		? prompt
		: [
				prompt,
				"## Your answer",
				`When you are done, pipe your answer, one JSON value that matches the schema below, to \`${runAnswerCommand(repo)}\`. It prints \`answer saved\` once hum has it, or what to fix: fix the answer and pipe it again until it prints \`answer saved\`, then end your turn.`,
				`\`\`\`json\n${JSON.stringify(answer.schema, null, 2)}\n\`\`\``,
			].join("\n\n");

/** What a row's order asks for each way it hands hum its answer, beside its title and the limit every row keeps. */
const ORDERS = {
	pipe: { ask: (brief: string) => `Do the work the Pad "${brief}" holds, then hand hum your answer as it says.`, done: "hum's answer command printed `answer saved` for your answer.", limit: "Hand your answer to hum only through its answer command." },
	question: { ask: (brief: string) => `Ask the owner the question the Pad "${brief}" holds, with your AskUserQuestion tool.`, done: "The owner answered your question.", limit: "Ask only with your AskUserQuestion tool." },
} as const satisfies Record<RowAnswer["by"], { readonly ask: (brief: string) => string; readonly done: string; readonly limit: string }>;

const orderOf = (name: string, { by }: RowAnswer): Json => ({
	kind: "work",
	title: railName(name),
	ask: ORDERS[by].ask(briefName(name)),
	done: ORDERS[by].done,
	limits: [ORDERS[by].limit, "Make no Todo."],
});

/** What a row may not do beyond every run's rules: make a Todo, which hum would read as new work. */
const ROW_DENY = ["mcp__roundup__todo_create", "Bash(rup todo create *)"];

/**
 * A row's settings: every run's, hum's exact model, auto mode, which the row starts in, the denials above, what `hum
 * run-answer` reads, and for a row that asks the owner a question, the hook that reports their answer.
 */
const rowSettings = (config: RowConfig, folder: RunFolder, env: Readonly<Record<string, string>>, model: string, answer: RowAnswer): Json => {
	const settings = runSettings(config, folder.hooks, env);
	const hooks = answer.by === "question" ? { ...settings.hooks, ...answerHooks(folder.hooks) } : settings.hooks;

	return { ...settings, hooks, model, permissions: { defaultMode: "auto", deny: [...settings.permissions.deny, ...ROW_DENY] } };
};

/** What starting a row reads of the owner's config: every run's rules, and how long a git command may take. */
export type RowConfig = Pick<HumConfig, "deniedRunCommands" | "runAutoMode" | "commandTimeoutSeconds">;

/** One row to start, under its item's Workstream. */
export type RowStart = {
	readonly name: string;
	readonly folder: RunFolder;
	readonly request: Pick<RunRequest, "prompt" | "cwd" | "model" | "effort" | "env" | "talk">;
	readonly answer: RowAnswer;
	readonly workstream: string;
};

const writeBrief = async (call: RoundupCall, name: string, text: string, workstream: string): Promise<void> => {
	const pad = briefName(name);

	await call("pad.create", { name: pad, text, visibility: "internal" }).catch(async (error: Error) => {
		if (!(error instanceof RoundupRefusal)) throw error;

		await call("pad.write", { name: pad, text });
	});
	await call("pad.move", { name: pad, home: workstream });
};

/**
 * Where a row starts: a row in the Project's own folder starts there, as roundup adopts no folder outside the
 * Program's Worktree path; any other row adopts its folder, on the branch the folder holds, with Worktrees on or off.
 */
const placeOf = async (config: RowConfig, repo: string, { request: { cwd }, name }: RowStart): Promise<{ readonly method: string; readonly params: Record<string, Json> }> =>
	cwd === repo
		? { method: "agent.spawn", params: { cwd, name: railName(name) } }
		: { method: "agent.adopt", params: { path: cwd, branch: (await gitIn(cwd, { timeoutMs: commandTimeoutMs(config) }).raw(["rev-parse", "--abbrev-ref", "HEAD"])).trim() } };

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
export const startRow = async (call: RoundupCall, { repo, stateDir, config }: { readonly repo: string; readonly stateDir: string; readonly config: RowConfig }, start: RowStart): Promise<RailNode> => {
	const { name, folder, request, answer, workstream } = start;

	await writeBrief(call, name, briefOf(request.prompt, answer, repo), workstream);

	const env = { ...request.env, HUM_RUN: name, HUM_RUN_KEY: runKey(stateDir, name), HUM_RUN_DIR: folder.root };
	const place = await placeOf(config, repo, start);

	const node = RailNode.parse(await call(place.method, { ...place.params, parent: workstream, order: orderOf(name, answer), model: await launchModel(call, request.model), effort: request.effort, settings: rowSettings(config, folder, env, request.model, answer), visibility: request.talk === true ? "shown" : "internal" }));

	atomicWrite(folder.row, JSON.stringify({ id: node.id, name }));
	await call("rail.rename", { id: node.id, name: railName(name) });

	return node;
};

export type RowsOptions = {
	readonly call: RoundupCall;
	/** The owner's repo, whose installed engine a row pipes its answer to. */
	readonly repo: string;
	readonly state: Pick<State, "dir" | "faults" | "limit" | "inbox">;
	readonly config: Pick<HumConfig, "deniedRunCommands" | "runAutoMode" | "backgroundPollSeconds" | "rowNoteWaitSeconds" | "commandTimeoutSeconds">;
	/** The runner for a cheap model call and a run with no name. */
	readonly fallback: Runner;
	readonly now: () => number;
	/** Ends the watch of the rows the owner talks to, as when hum stops. */
	readonly signal?: AbortSignal;
};

/** What hum reads of a run's row at one moment. */
type Reading = { readonly node: RailNode | undefined; readonly transcript: RunTranscript; readonly sessionId: string | undefined; readonly stops: number };

/** A run hum looks at: its name, its folder, the row it runs as, whether the owner talks to it, and the tokens it may spend. */
type Looked = { readonly name: string; readonly folder: RunFolder; readonly row: string; readonly talks: boolean; readonly tokenCap: number | undefined };

/**
 * What hum does about a run's row after one reading of it: nothing yet, send the row its one note, or end the run, with
 * the row stopped first where it still runs, and with the usage limit it hit saved.
 */
type Verdict =
	| { readonly kind: "wait" }
	| { readonly kind: "note"; readonly body: string }
	| { readonly kind: "end"; readonly stop: boolean; readonly outcome: RunOutcome }
	| { readonly kind: "limit"; readonly limit: LimitEnded };

const WAIT: Verdict = { kind: "wait" };

const WAITING: RunOutcome = { kind: "waiting" };

/** What a look at a run's row has seen so far: the session the row reported, and whether its first model message came. */
type Seen = { session?: string; announced: boolean };

/** The card for a read of the Rail that failed while hum watched the rows the owner talks to. */
export const TALK_WATCH_CODE = "talk-watch";

/**
 * Runs each named agent run as a Rail row, an Agent roundup starts in the run's slot under the item's Workstream, so
 * the owner sees it, its diff and its questions. The run's prompt rides in a Pad, and its answer comes back through
 * `hum run-answer`, which counts only under the run's key. A row found alive under the run's name is taken over, never
 * started twice, and one hum stops on its way out is left running for the next hum to take over. A row that ends a turn
 * with no answer gets one note; a second such turn, or no new turn within the configured wait, stops it and fails the
 * run. A run the owner talks to starts shown, adopting a talk copy of its own, so its siblings run beside it in theirs.
 * Its answer counts only once roundup showed the row waiting on the owner; one that answers and goes idle without
 * asking gets one note to ask first, and hum drops what it saved so far. Answering so again stops it and
 * fails the run. Each call looks at such a run's row once: while the row waits on the owner the run comes back waiting
 * and the row goes on, and one watch reads the Rail each poll for every such row, marks a row asked once roundup shows it
 * waiting on the owner, and wakes the worker for an item whose row hum must look at. A cheap model call and a run with
 * no name go to `fallback`.
 */
export const railRunner = ({ call, repo, state, config, fallback, now, signal }: RowsOptions): Runner => {
	const pollMs = config.backgroundPollSeconds * SECOND_MS;
	const noteWaitMs = config.rowNoteWaitSeconds * SECOND_MS;

	const tree = (): Promise<RailNode[]> => railTree(call);

	const recordOf = (folder: RunFolder) => orMissing(() => RowRecord.parse(JSON.parse(readFileSync(folder.row, "utf8"))), undefined);

	/**
	 * The row a run is taken over in: the one its folder records, else a live one of its name in the item's Workstream,
	 * as after a crash between start and record. A run the owner talks to keeps its recorded row once that ended, so a
	 * look reads the end; any other run whose recorded row ended starts anew.
	 */
	const rowOf = async (folder: RunFolder, name: string, workstream: string, talks: boolean): Promise<string | undefined> => {
		const recorded = recordOf(folder)?.id;

		if (talks && recorded !== undefined) return recorded;

		const live = (await tree()).filter((node) => node.status?.kind !== ENDED);

		return live.find((node) => node.id === recorded)?.id ?? live.find((node) => node.parent === workstream && node.name === railName(name))?.id;
	};

	const stop = async (row: string): Promise<void> => {
		await call("agent.stop", { id: row }).catch((error: Error) => {
			if (!(error instanceof RoundupRefusal)) throw error;
		});
	};

	const readRow = (row: string, folder: RunFolder, nodes: readonly RailNode[]): Reading => {
		const reports = hookReports(folder.hooks);
		const path = reports.find(({ transcriptPath }) => transcriptPath !== undefined)?.transcriptPath;
		const text = path === undefined ? "" : orMissing(() => readFileSync(path, "utf8"), "");

		return {
			node: nodes.find((node) => node.id === row),
			transcript: readTranscript(text),
			sessionId: reports[0]?.sessionId,
			stops: reports.filter(({ event }) => event === STOP_EVENT).length,
		};
	};

	/** The note hum sent the row, if any: kept in the run's folder, so a hum that takes the row over sends no second one. */
	const noted = (folder: RunFolder): { readonly at: number; readonly stops: number } | undefined =>
		orMissing(() => ({ at: statSync(folder.noted).mtimeMs, ...NotedMark.parse(JSON.parse(readFileSync(folder.noted, "utf8"))) }), undefined);

	/**
	 * What hum's one note to a row says: a row with no answer yet is told how to hand it over; a row the owner talks to
	 * that answered without asking them is told to ask first.
	 */
	const NOTES = {
		answer: (name: string) => `hum has no answer from you yet. Hand it over as the Pad "${briefName(name)}" says: pipe it to hum's answer command until it prints \`answer saved\`.`,
		ask: () => "hum counts your answer only once the owner answered a question of yours in this row. Ask them with your AskUserQuestion tool, then hand your answer over again.",
	} as const;

	const note = async (row: string, body: string, folder: RunFolder, stops: number): Promise<void> => {
		await call("message.send", { to: row, kind: "note", body });
		atomicWrite(folder.noted, JSON.stringify({ stops }));
	};

	/** The answer the run saved; a run the owner talks to counts only one saved once roundup showed its row waiting on the owner. */
	const answerAt = ({ folder, name, talks }: Looked, node: RailNode | undefined): Json | undefined => {
		const key = runKey(state.dir, name);

		if (!talks) return takeAnswer(folder, key, name);

		if (node?.status?.kind === NEEDS_YOU) markAsked(folder, node.status.since ?? now());

		const since = askedSince(folder);

		return since === undefined ? undefined : takeAnswer(folder, key, name, since);
	};

	/** What hum does about a run's row at `reading`. */
	const verdictOf = (looked: Looked, { node, transcript, sessionId, stops }: Reading): Verdict => {
		const { name, folder, talks, tokenCap } = looked;
		const answer = answerAt(looked, node);
		const ended = (why: string, stop = true): Verdict => ({ kind: "end", stop, outcome: finishedOf(sessionId, transcript, failedWith(why, ROW_STOPPED)) });

		if (answer !== undefined) return { kind: "end", stop: true, outcome: finishedOf(sessionId, transcript, succeededWith(answer)) };

		if (node === undefined || node.status?.kind === ENDED) return ended(`the row "${railName(name)}" ended before it answered`, false);

		const tokens = tokensOf(transcript);

		if (tokenCap !== undefined && tokens > tokenCap) return { kind: "end", stop: true, outcome: { kind: "over-cap", tokens } };

		if (transcript.limit !== undefined) return { kind: "limit", limit: limitOf(transcript.limit.text, transcript.limit.resetsAt) };

		if (transcript.apiError !== undefined) return ended(transcript.apiError);

		const mark = noted(folder);
		const idle = node.status?.kind === IDLE;
		const due = talks ? idle && askedSince(folder) === undefined && hasSavedAnswer(folder) : stops > 0;

		if (mark === undefined && due) return { kind: "note", body: talks ? NOTES.ask() : NOTES.answer(name) };

		if (mark !== undefined && due && stops > mark.stops) return ended(talks ? `the row "${railName(name)}" answered again after hum's note without asking the owner` : `the row "${railName(name)}" ended a turn after hum's note with no answer`);

		if (!talks && mark !== undefined && idle && now() - mark.at > noteWaitMs) return ended(`the row "${railName(name)}" stayed idle ${config.rowNoteWaitSeconds} seconds after hum's note with no answer`);

		return WAIT;
	};

	/** Carries a verdict out: the note sent, or the run's end with its row stopped first where it still runs; undefined while the run goes on. */
	const act = async (verdict: Verdict, { row, folder, talks }: Looked, stops: number): Promise<RunOutcome | undefined> => {
		switch (verdict.kind) {
			case "wait":
				return undefined;
			case "note":
				if (talks) dropAnswers(folder);

				await note(row, verdict.body, folder, stops);

				return undefined;
			case "end":
				if (verdict.stop) await stop(row);

				return verdict.outcome;
			case "limit":
				await stop(row);

				return settleLimit(state, verdict.limit);
		}
	};

	/** One look at a run's row: what hum reads of it, then what it does about that; undefined while the run goes on. */
	const look = async (looked: Looked, request: Pick<RunRequest, "onSession" | "onFirstToken">, seen: Seen): Promise<RunOutcome | undefined> => {
		const reading = readRow(looked.row, looked.folder, await tree());

		if (seen.session === undefined && reading.sessionId !== undefined) request.onSession?.((seen.session = reading.sessionId));

		if (!seen.announced && Object.keys(reading.transcript.messages).length > 0) {
			seen.announced = true;
			request.onFirstToken?.();
		}

		return act(verdictOf(looked, reading), looked, reading.stops);
	};

	/** Looks at a run's row each poll until the run ends. hum itself stops here, as when it shuts down: the row and its folder stay, so the next hum takes the row over. */
	const watch = async (request: RunRequest, looked: Looked): Promise<RunOutcome> => {
		const seen: Seen = { announced: false };

		for (;;) {
			if (request.signal?.aborted) return { kind: "stopped" };

			const outcome = await look(looked, request, seen);

			if (outcome !== undefined) return outcome;

			await Bun.sleep(pollMs);
		}
	};

	/** The runs the owner talks to that hum keeps, each with its item, and with what a look reads once its row is recorded. */
	const keptTalks = (): { readonly item: string; readonly folder: RunFolder; readonly looked: Looked | undefined }[] =>
		runFolders(state.dir).flatMap((folder) => {
			const talk = talkRunOf(folder);
			const row = recordOf(folder);

			return talk === undefined ? [] : [{ item: talk.item, folder, looked: row && { name: row.name, folder, row: row.id, talks: true, tokenCap: talk.tokenCap } }];
		});

	/**
	 * Each kept run the owner talks to, with whether its row waits on them, from one read of the Rail. The runs are read
	 * from their folders after the Rail, so a run begun meanwhile counts. One whose row is not recorded needs a pass to
	 * start or find it; a read that fails raises one card and finds every recorded row waiting, so none wakes on it. With
	 * no such run kept, nothing is left to watch, and that card clears.
	 */
	const talkReadings = async (): Promise<{ readonly item: string; readonly folder: RunFolder; readonly waits: boolean }[]> => {
		if (keptTalks().length === 0) {
			state.faults.clear({ code: TALK_WATCH_CODE });

			return [];
		}

		const nodes = await tree().then(
			(read) => {
				state.faults.clear({ code: TALK_WATCH_CODE });

				return read;
			},
			(error: Error) => {
				if (signal?.aborted) return undefined;

				state.faults.raise({ code: TALK_WATCH_CODE, cause: `hum could not read roundup's Rail to watch the rows you talk to: ${error.message}`, fix: "hum reads it again at its next poll or tick." });

				return undefined;
			},
		);

		return keptTalks().map(({ item, folder, looked }) => ({ item, folder, waits: looked !== undefined && (nodes === undefined || verdictOf(looked, readRow(looked.row, folder, nodes)).kind === "wait") }));
	};

	/** Whether the talk watch runs: one at a time. */
	let watching = false;

	/** The runs whose need of hum the talk watch told the worker of; a call that looks at a run takes it off, so a later need tells again. */
	const told = new Set<string>();

	/**
	 * Reads the Rail each poll while a row the owner talks to waits on them, with no pass watching it. A read marks a row
	 * asked once roundup shows it waiting on the owner, and a row hum must look at wakes the worker for its item, once.
	 */
	const watchTalks = (): void => {
		if (watching || signal?.aborted) return;

		watching = true;

		const watched = async (): Promise<void> => {
			while (!signal?.aborted) {
				const readings = await talkReadings();

				for (const { item, folder } of readings.filter(({ waits, folder: run }) => !waits && !told.has(run.root))) {
					told.add(folder.root);
					dropInto(state.inbox, item);
				}

				if (!readings.some(({ waits }) => waits)) return;

				await Bun.sleep(pollMs);
			}
		};

		void watched()
			.catch((error: Error) => void state.faults.raise({ code: TALK_WATCH_CODE, cause: `hum stopped watching the rows you talk to: ${error.message}`, fix: "hum starts watching them again at its next tick." }))
			.finally(() => {
				watching = false;
			});
	};

	/** A refusal to start a row, held with one card that names roundup's words, what they mean and the fix. */
	const refused = (error: RoundupRefusal): RunOutcome => ({
		kind: "held",
		card: state.faults.raise({ code: ROW_REFUSED_CODE, ...refusalCard(error) }),
	});

	/** Starts a row and records it in its run's folder, or takes over the one recorded or alive under the run's name, and looks at it. */
	const run = async (request: RunRequest): Promise<RunOutcome> => {
		const { name, item } = request;

		if (request.call === "judgment" || name === undefined) return fallback.run(request);

		if (item === undefined) throw new Error(`the run "${name}" names no item, and a Rail row sits in its item's Workstream`);

		if (now() < savedLimitUntil(state)) return { kind: "limited", until: savedLimitUntil(state) };

		const folder = runFolder(state.dir, name);
		const talks = request.talk === true;

		keepSchema(folder, request);

		if (talks) keepTalkRun(folder, { item: item.id, tokenCap: request.tokenCap });

		/* The row's hooks write into this folder and do not make it. */
		mkdirSync(folder.hooks, { recursive: true });
		told.delete(folder.root);

		try {
			const workstream = await itemWorkstream(call, item);
			const row = (await rowOf(folder, name, workstream, talks)) ?? (await startRow(call, { repo, stateDir: state.dir, config }, { name, folder, request, answer: { by: "pipe", schema: request.schema }, workstream })).id;

			state.faults.clear({ code: ROW_REFUSED_CODE });

			const looked: Looked = { name, folder, row, talks, tokenCap: request.tokenCap };
			const outcome = talks ? ((await look(looked, request, { announced: false })) ?? WAITING) : await watch(request, looked);

			if (outcome.kind === "waiting") watchTalks();
			else if (outcome.kind !== "stopped") rmSync(folder.root, { recursive: true, force: true });

			return outcome;
		} catch (error) {
			if (error instanceof RoundupRefusal) return refused(error);

			throw error;
		}
	};

	/** The items whose runs the owner talks to hum keeps, each with whether all of them wait on the owner; while one does, the talk watch runs. */
	const talking = async (): Promise<ReadonlyMap<string, boolean>> => {
		const readings = await talkReadings();

		if (readings.some(({ waits }) => waits)) watchTalks();

		return readings.reduce((items, { item, waits }) => items.set(item, (items.get(item) ?? true) && waits), new Map<string, boolean>());
	};

	/** A run whose row could not be stopped still loses its folder, so no watch or talk copy holds on to it. */
	const forgetRun = async (folder: RunFolder): Promise<void> => {
		const row = recordOf(folder)?.id;

		try {
			if (row !== undefined) await stop(row);
		} finally {
			rmSync(folder.root, { recursive: true, force: true });
		}
	};

	const forget = async (names: readonly string[]): Promise<void> => {
		const failed = (await Promise.allSettled(names.map((name) => forgetRun(runFolder(state.dir, name))))).find((settled) => settled.status === "rejected");

		if (failed) throw failed.reason;
	};

	/** The names of the runs whose rows are alive in a run slot; a run the owner talks to holds none. */
	const liveRuns = async (): Promise<ReadonlySet<string>> => {
		const live = new Set((await tree()).filter((node) => node.status?.kind !== ENDED).map(({ id }) => id));

		const rows = runFolders(state.dir).flatMap((folder) => {
			const row = talkRunOf(folder) === undefined ? recordOf(folder) : undefined;

			return row === undefined ? [] : [row];
		});

		return new Set(rows.filter(({ id }) => live.has(id)).map(({ name }) => name));
	};

	return { run, limitedUntil: fallback.limitedUntil, liveRuns, talking, forget, talks: true };
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
