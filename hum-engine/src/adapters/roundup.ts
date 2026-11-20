import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import { z } from "zod";
import { ADAPTER_API_VERSION, type AdapterContext, type Answers, type Claim, Holder, type Integrations, type Item, ItemId, type ItemRef, PermanentError, type Question, type Questions, type ThreadEntry, type Watch, type WorkSource } from "../adapter-api.ts";
import { hashJson } from "../config/hash.ts";
import type { HumConfig } from "../config/schema.ts";
import { atomicWrite, dropInto, listFiles, orMissing, slug } from "../state/fs.ts";
import { INBOX_DIR } from "../state/open.ts";
import { parseArgument } from "./argument.ts";
import { claimer, isLive } from "./claim.ts";
import { commentText, cutLine, followUpBody, isFollowUpOf, type Marker, markedLine, parseComment, questionText } from "./marked.ts";
import { itemWorkstream, type RailNode, railTree, rootWorkstream } from "./rail.ts";
import { type RowConfig, startRow } from "./rail-rows.ts";
import { HUM_EXT, type RoundupEvent, RoundupRefusal, roundupRpc } from "./roundup-rpc.ts";
import { keepSchema, type RunFolder, runFolderAt, runKey, takeAnswer } from "./run-answer.ts";

/** The name `hum.json` gives the roundup adapter. */
export const ROUNDUP = "roundup";

/** Whether any slot `integrations` names is served by roundup. */
export const doesUseRoundup = (integrations: HumConfig["integrations"]): boolean => Object.values(integrations ?? {}).includes(ROUNDUP);

/** An Agent's comment on a Todo is one line of at most this many characters. */
const COMMENT_LIMIT = 280;

/** The digest in a Pad's name, so the same text posts to the same Pad name. */
const PAD_DIGEST_LENGTH = 8;

/** The status of a row that waits on the owner. */
const NEEDS_YOU = "needs-you";

/** A question row only asks and hands the answer over. */
const QUESTION_EFFORT = "low";

/** Two workers that take the same item one after another wait this long for each other. */
const CLAIM_LOCK = { retries: { retries: 20, minTimeout: 5, maxTimeout: 50 }, realpath: false } as const;

/** Under hum's state, what the roundup adapter keeps that roundup holds for no Ext: claims, questions, and how far it followed roundup's Event log. */
const foldersOf = (stateDir: string) => {
	const root = join(stateDir, ROUNDUP);

	return { claims: join(root, "claims"), questions: join(root, "questions"), position: join(root, "position"), inbox: join(stateDir, INBOX_DIR) };
};

const TodoId = ItemId.refine((id) => /^(0|[1-9]\d*)$/.test(id), "a roundup Todo id is a whole number").transform(Number);

const Todo = z.looseObject({ id: z.int().nonnegative(), title: z.string(), body: z.string(), done: z.boolean(), blocked: z.boolean(), home: z.string().nullish() });

type Todo = z.infer<typeof Todo>;

const Comment = z.looseObject({ author: z.looseObject({ id: z.string() }), body: z.string(), created_at: z.number() });

const Kept = z.strictObject({ holder: Holder, expiresAt: z.number() });

/** The owner's answer hum took from a question row. */
const Taken = z.strictObject({ text: z.string(), option: z.string().optional(), at: z.number() });

/** A question hum asked as a row, named `name`. */
const Asked = z.strictObject({ item: z.string(), name: z.string(), text: z.string(), at: z.number() });

/** When roundup first showed a question row as waiting on the owner. */
const AskedMark = z.strictObject({ since: z.number() });

const RowRecord = z.looseObject({ id: z.string() });

const StatusEvent = z.looseObject({ id: z.string(), status: z.looseObject({ kind: z.string(), since: z.number() }) });

const Picked = z.looseObject({ text: z.string(), option: z.string().optional() });

const Ping = z.looseObject({ projectKey: z.string() });

export type RoundupOptions = {
	/** The Project's Daemon socket; default `RUPD_SOCKET`. */
	readonly socket?: string;
	/** The root Workstream whose open Todos are hum's items. */
	readonly workstream: string;
	readonly stateDir: string;
	/** The Project's folder, where a question row starts. */
	readonly repo: string;
	/** What a question row runs on: the light model and every run's rules. */
	readonly config: RowConfig & Pick<HumConfig, "models">;
};

type Whole = Integrations & {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly answers: Answers;
	/** Always 0: roundup's socket is local and has no rate limit. */
	readonly spent: () => number;
	readonly close: () => Promise<void>;
};

const readJson = <T>(schema: z.ZodType<T>, path: string): T | undefined => orMissing(() => schema.parse(JSON.parse(readFileSync(path, "utf8"))), undefined);

/** The answer a question row hands over: the owner's words, and the option they picked where it offered some. */
const answerSchema = (options: Question["options"] = []): object => {
	const [first, ...rest] = options;
	const text = z.string().min(1);

	return z.toJSONSchema(first === undefined ? z.strictObject({ text }) : z.strictObject({ text, option: z.enum([first, ...rest]).optional() }));
};

const askPrompt = ({ text, options, detail }: Question): string =>
	[
		"Ask the owner the question below with your AskUserQuestion tool, in its words, and wait for their answer. Never answer it yourself, and do nothing else.",
		`## The question\n\n${text}`,
		options?.length ? `Offer each of these as an option: ${options.join(", ")}. The owner may answer in their own words instead.` : "",
		detail ? `## Why hum asks\n\n${detail}\n\nUse it only to explain the question when the owner asks why.` : "",
		'Then hand hum the answer: "text" holds what the owner said, and "option" the option they picked, if any.',
	]
		.filter(Boolean)
		.join("\n\n");

/** The item's own Workstream, "#<id> …", at the Project's root. */
const isItemWorkstream = (id: string | number, node: RailNode): boolean => node.kind === "workstream" && !node.parent && node.name.startsWith(`#${id} `);

const isOneLine = (text: string): boolean => !text.includes("\n") && text.length <= COMMENT_LIMIT;

/**
 * roundup as a work source over its Daemon's socket, as `ext:hum`. An item is an open, unblocked Todo in the root
 * Workstream `workstream` names, or in its own Workstream "#<id> <title>" once its claim lapsed; a Todo a run makes in
 * an item's Workstream is never one. The first claim moves the Todo into its own Workstream, and roundup holds no
 * claim an Ext could write, so the holder and expiry stay in hum's state. Finishing completes the Todo, moves it back
 * where the owner put it, and removes its Workstream with every row and Pad in it. The thread is hum's own comments on
 * the Todo, the questions hum asked as rows, and each answer a row saved after roundup showed it waiting on the owner;
 * the owner answers only there, never in a Todo comment or through `hum answer`. The watch follows roundup's Event
 * log, and each change to an item or a question row wakes the worker.
 */
export const roundupAdapter = (options: RoundupOptions, { now, env }: AdapterContext): Whole => {
	const socket = options.socket ?? env.RUPD_SOCKET;

	if (!socket) throw new PermanentError("the roundup adapter runs only where roundup serves the Project: RUPD_SOCKET is not set");

	const dirs = foldersOf(options.stateDir);

	const questionFolders = () =>
		listFiles(dirs.questions).flatMap((root) => {
			const asked = readJson(Asked, join(root, "question.json"));

			return asked ? [{ root, folder: runFolderAt(root), asked, row: readJson(RowRecord, runFolderAt(root).row)?.id }] : [];
		});

	type Asking = ReturnType<typeof questionFolders>[number];

	const markAsked = ({ root }: Pick<Asking, "root">, since: number): void => {
		const mark = join(root, "asked.json");

		if (readJson(AskedMark, mark) === undefined) atomicWrite(mark, JSON.stringify({ since }));
	};

	/** Whether an Event changes what hum reads: a Todo someone else changed, or the status of a question row, whose waiting on the owner it marks. */
	const isChange = ({ name, actor, data }: RoundupEvent): boolean => {
		if (name.startsWith("todo.")) return actor?.id !== HUM_EXT;

		const status = name === "agent.status" ? StatusEvent.safeParse(data).data : undefined;
		const asking = status && questionFolders().find(({ row }) => row === status.id);

		if (asking && status.status.kind === NEEDS_YOU) markAsked(asking, status.status.since);

		return asking !== undefined;
	};

	let changedAt: number | undefined;

	const client = roundupRpc(socket, HUM_EXT, {
		from: readJson(z.number(), dirs.position),
		onEvent: (event) => {
			if (!isChange(event)) return;

			changedAt = event.seq;
			atomicWrite(dirs.position, String(event.seq));
			dropInto(dirs.inbox, "");
		},
	});

	const { call } = client;

	const todoOf = async (id: string) => Todo.parse(await call("todo.get", { id: parseArgument(TodoId, id) }));

	const todos = async () => z.array(Todo).parse(await call("todo.list"));

	const humOf = (nodes: readonly RailNode[]) => rootWorkstream(nodes, options.workstream);

	const humWorkstream = (nodes: readonly RailNode[]): RailNode => {
		const found = humOf(nodes);

		if (!found) throw new PermanentError(`roundup has no Workstream named "${options.workstream}" at the Project's root: make it, and put there the Todos hum should build`);

		return found;
	};

	/** Open, unblocked, and where hum takes items: the owner's Workstream, or the item's own. */
	const isOpen = (todo: Todo, nodes: readonly RailNode[]): boolean =>
		!todo.done && !todo.blocked && (todo.home === humOf(nodes)?.id || nodes.some((node) => node.id === todo.home && isItemWorkstream(todo.id, node)));

	const claimFile = (id: string) => join(dirs.claims, `${id}.json`);

	const standing = (id: ItemId) => {
		const kept = readJson(Kept, claimFile(id));

		return kept && { claim: { item: id, ...kept } };
	};

	const isFree = (id: ItemId): boolean => !isLive(standing(id)?.claim, now());

	const isSame = (one: Claim | undefined, other: Claim | undefined): boolean => one?.holder === other?.holder && one?.expiresAt === other?.expiresAt;

	/** Writes `claim` over `over` while no other worker wrote since; false when one did. */
	const keepClaim = async (claim: Claim, over: Claim | undefined): Promise<boolean> => {
		mkdirSync(dirs.claims, { recursive: true });

		const release = await lock(dirs.claims, { ...CLAIM_LOCK, lockfilePath: `${claimFile(claim.item)}.lock` });

		try {
			if (!isSame(standing(claim.item)?.claim, over)) return false;

			atomicWrite(claimFile(claim.item), JSON.stringify({ holder: claim.holder, expiresAt: claim.expiresAt }));

			return true;
		} finally {
			await release();
		}
	};

	/** A won claim takes the Todo out of the owner's Workstream into its own. */
	const takeIn = async (id: ItemId): Promise<void> => {
		const [todo, nodes] = await Promise.all([todoOf(id), railTree(call)]);

		if (todo.home !== humWorkstream(nodes).id) return;

		await call("todo.move", { id: todo.id, home: await itemWorkstream(call, { id, title: todo.title }) });
	};

	const take = claimer(
		{
			standing: async (id) => standing(id),
			isReady: async (id) => {
				const [todo, nodes] = await Promise.all([todoOf(id), railTree(call)]);

				return isOpen(todo, nodes);
			},
			write: async (claim, over) => {
				const won = await keepClaim(claim, over?.claim);

				if (won) await takeIn(claim.item);

				return won;
			},
		},
		now,
	);

	const stop = async (row: string | undefined): Promise<void> => {
		if (row === undefined) return;

		await call("agent.stop", { id: row }).catch((error: Error) => {
			if (!(error instanceof RoundupRefusal)) throw error;
		});
	};

	const takenOf = ({ root }: Pick<Asking, "root">) => readJson(Taken, join(root, "taken.json"));

	const questionsOf = (id: string) => questionFolders().filter(({ asked }) => asked.item === id);

	/** Takes each open question's answer that its row saved after roundup showed it waiting on the owner, and stops the row. */
	const takeAnswers = async (id: string, nodes: readonly RailNode[]): Promise<void> => {
		for (const asking of questionsOf(id).filter((open) => takenOf(open) === undefined)) {
			const status = nodes.find((node) => node.id === asking.row)?.status;

			if (status?.kind === NEEDS_YOU && status.since !== undefined) markAsked(asking, status.since);

			const mark = readJson(AskedMark, join(asking.root, "asked.json"));
			const answer = mark && takeAnswer(asking.folder, runKey(options.stateDir, asking.asked.name), asking.asked.name, mark.since);

			if (answer === undefined) continue;

			const { text, option } = Picked.parse(answer);

			atomicWrite(join(asking.root, "taken.json"), JSON.stringify({ text, option, at: now() }));
			await stop(asking.row);
		}
	};

	const threadOf = async (id: string, nodes: readonly RailNode[]): Promise<ThreadEntry[]> => {
		await takeAnswers(id, nodes);

		const comments = z.array(Comment).parse(await call("todo.comments", { id: parseArgument(TodoId, id) }));

		return [
			...comments.flatMap((comment): ThreadEntry[] => (comment.author.id === HUM_EXT ? [{ ...parseComment(comment.body, comment.created_at), author: "hum" }] : [])),
			...questionsOf(id).flatMap((asking): ThreadEntry[] => {
				const taken = takenOf(asking);

				return [{ kind: "question", text: asking.asked.text, at: asking.asked.at, author: "hum" }, ...(taken ? [{ kind: "answer", ...taken, author: "person" } as const] : [])];
			}),
		].sort((one, other) => one.at - other.at);
	};

	const post = async (id: string, text: string): Promise<void> => {
		await call("todo.comment", { id: parseArgument(TodoId, id), body: text });
	};

	/** A text too long for one comment goes whole into a Pad in the item's Workstream; the comment holds its first words and the Pad's name. */
	const postInPad = async (id: string, marker: Marker | undefined, text: string): Promise<void> => {
		const name = `hum ${id} ${hashJson(text).slice(0, PAD_DIGEST_LENGTH)}`;
		const { home } = await todoOf(id);

		await call("pad.create", { name, text, visibility: "internal" });

		if (home) await call("pad.move", { name, home });

		await post(id, cutLine(marker, text, ` … full text in Pad "${name}"`, COMMENT_LIMIT));
	};

	const postPlain = async (id: string, text: string): Promise<void> => (isOneLine(text) ? post(id, text) : postInPad(id, undefined, text));

	const ask = async (id: ItemId, question: Question): Promise<void> => {
		const name = `hum ${id} ask ${questionsOf(id).length + 1}`;
		const root = join(dirs.questions, slug(name));
		const folder: RunFolder = runFolderAt(root);
		const schema = answerSchema(question.options);
		const todo = await todoOf(id);

		keepSchema(folder, { schema });
		/* The row's hooks write into this folder and do not make it. */
		mkdirSync(folder.hooks, { recursive: true });

		const request = { prompt: askPrompt(question), schema, cwd: options.repo, model: options.config.models.light, effort: QUESTION_EFFORT } as const;

		const row = await startRow(call, { stateDir: options.stateDir, config: options.config }, { name, folder, request, workstream: await itemWorkstream(call, { id, title: todo.title }), adopt: false });

		/* Asked when roundup started the row, on the clock its comments carry, so the thread keeps their order. */
		atomicWrite(join(root, "question.json"), JSON.stringify({ item: id, name, text: questionText(question), at: row.status?.since ?? now() }));
	};

	return {
		apiVersion: ADAPTER_API_VERSION,
		spent: () => 0,
		close: async () => client.close(),
		workSource: {
			listReady: async () => {
				const [list, nodes] = await Promise.all([todos(), railTree(call)]);

				humWorkstream(nodes);

				return list.flatMap((todo): ItemRef[] => {
					const id = ItemId.parse(String(todo.id));

					return isOpen(todo, nodes) && isFree(id) ? [{ id, title: todo.title }] : [];
				});
			},
			read: async (id): Promise<Item> => {
				const [todo, nodes] = await Promise.all([todoOf(id), railTree(call)]);

				return { id, title: todo.title, body: todo.body, ready: isOpen(todo, nodes) && isFree(id), thread: await threadOf(id, nodes) };
			},
			claim: (id, holder, ttlMs) => take("claim", parseArgument(ItemId, id), holder, ttlMs),
			renew: (id, holder, ttlMs) => take("renew", parseArgument(ItemId, id), holder, ttlMs),
			comment: (id, text) => postPlain(id, commentText(text)),
			fileFollowUp: async (from, { title, body }) => {
				const [list, nodes] = await Promise.all([todos(), railTree(call)]);
				const hum = humWorkstream(nodes);
				const filed = list.find(isFollowUpOf(`#${from}`, title)) ?? Todo.parse(await call("todo.create", { title, body: followUpBody(body, `#${from}`) }));

				if (!filed.home) await call("todo.move", { id: filed.id, home: hum.id });

				return { id: ItemId.parse(String(filed.id)), title };
			},
			finish: async (id) => {
				const todo = await todoOf(id);

				if (!todo.done) await call("todo.complete", { id: todo.id });

				const nodes = await railTree(call);

				/* Only a Todo in its own Workstream goes back to the owner's, as removing that Workstream would delete it. */
				if (nodes.some((node) => node.id === todo.home && isItemWorkstream(id, node))) await call("todo.move", { id: todo.id, home: humOf(nodes)?.id ?? null });

				for (const node of nodes.filter((found) => isItemWorkstream(id, found)))
					await call("rail.remove", { id: node.id, scope: "all" }).catch((error: Error) => {
						if (!(error instanceof RoundupRefusal)) throw error;
					});

				for (const { root } of questionsOf(id)) rmSync(root, { recursive: true, force: true });

				rmSync(claimFile(id), { force: true });
			},
		},
		questions: {
			ask,
			decide: async (id, text) => {
				const line = markedLine({ kind: "decision" }, text);

				return isOneLine(line) ? post(id, line) : postInPad(id, { kind: "decision" }, text);
			},
		},
		answers: {
			/** On roundup a question is its row: the owner answers there, so an answer through hum is refused with the row's link. */
			answer: async (id) => {
				const { projectKey } = Ping.parse(await call("daemon.ping"));
				const links = questionsOf(id).flatMap((asking) => (takenOf(asking) === undefined && asking.row !== undefined ? [`roundup://agent/${asking.row}?project=${projectKey}`] : []));

				throw new PermanentError(links.length > 0 ? `On roundup the owner answers in the question's row: ${links.join(", ")}` : `On roundup the owner answers only in a question's row, and #${id} has no open question`);
			},
			/** The socket is local: none of this spends rate limit. */
			watch: async (since?: string): Promise<Watch> => {
				await client.open();

				const token = String(changedAt ?? client.position() ?? 0);

				return { token, changed: token !== since };
			},
		},
	};
};
