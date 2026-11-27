import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import { z } from "zod";
import { ADAPTER_API_VERSION, type AdapterContext, type Answers, type Claim, Holder, type Integrations, type Item, ItemGone, ItemId, type ItemRef, type OwnerHandoff, PermanentError, type Question, type Questions, type ThreadEntry, type Watch, type WorkSource } from "../adapter-api.ts";
import { hashJson } from "../config/hash.ts";
import type { Json } from "../config/json.ts";
import type { HumConfig } from "../config/schema.ts";
import { atomicWrite, dropInto, listFiles, orMissing, slug } from "../state/fs.ts";
import { INBOX_DIR } from "../state/open.ts";
import { parseArgument } from "./argument.ts";
import { claimer, isHeldBy, isLive } from "./claim.ts";
import { handoffPadName, handoffText } from "./handoff-pad.ts";
import { ownerAnswers } from "./hooked-run.ts";
import { commentText, cutLine, followUpBody, isFollowUpOf, type Marker, markedLine, optionsIn, parseComment, questionOf, questionText } from "./marked.ts";
import { agentLink, askName, ENDED, isItemWorkstream, itemWorkstream, NEEDS_YOU, NOT_FOUND, padLink, projectKeyOf, putPad, type RailNode, railName, railTree, rootWorkstream } from "./rail.ts";
import { type RowConfig, startRow } from "./rail-rows.ts";
import { HUM_EXT, type RoundupEvent, RoundupRefusal, roundupRpc } from "./roundup-rpc.ts";
import { requestEntry } from "./request-entry.ts";
import { askedSince, markAsked, type RunFolder, runFolderAt } from "./run-answer.ts";

/** The name `hum.json` gives the roundup adapter. */
export const ROUNDUP = "roundup";

/** Whether any slot `integrations` names is served by roundup. */
export const doesUseRoundup = (integrations: HumConfig["integrations"]): boolean => Object.values(integrations ?? {}).includes(ROUNDUP);

/** An Agent's comment on a Todo is one line of at most this many characters. */
const COMMENT_LIMIT = 280;

/** The digest in a Pad's name, so the same text posts to the same Pad name. */
const PAD_DIGEST_LENGTH = 8;

/** A question row only asks. */
const QUESTION_EFFORT = "low";

/** The card for an answer a question row's hook reported that hum cannot take as one answer to its question. */
const UNREAD_ANSWER_CODE = "question-answer-unread";

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
const Asked = z.strictObject({ item: z.string(), name: z.string(), text: z.string(), at: z.number(), handoff: z.strictObject({ name: z.string(), link: z.string() }).optional() });

const RowRecord = z.looseObject({ id: z.string() });

const StatusEvent = z.looseObject({ id: z.string(), status: z.looseObject({ kind: z.string(), since: z.number() }) });

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

/** A Pad the owner reads, by its name and its link. */
type Linked = { readonly name: string; readonly link: string };

const askPrompt = ({ text, options, detail }: Question, handoff: Linked | undefined): string =>
	[
		"Ask the owner the question below with your AskUserQuestion tool, in its words: one call that holds only this question. Never answer it yourself, and do nothing else. hum takes the owner's answer from the tool, and your turn ends there.",
		`## The question\n\n${text}`,
		handoff ? `End the question's text with this line, so the owner reads what they decide before they answer: Read the Pad "${handoff.name}" first: ${handoff.link}` : "",
		[options?.length ? `Offer each of these as an option, labeled exactly so: ${options.join(", ")}.` : "", "The tool takes two to four options: add options that fit the question until it has two. The owner may answer in their own words instead."].filter(Boolean).join(" "),
		detail ? `## Why hum asks\n\n${detail}\n\nUse it only to explain the question when the owner asks why.` : "",
	]
		.filter(Boolean)
		.join("\n\n");

const isOneLine = (text: string): boolean => !text.includes("\n") && text.length <= COMMENT_LIMIT;

/**
 * roundup as a work source over its Daemon's socket, as `ext:hum`. An item is an open, unblocked Todo in the root
 * Workstream `workstream` names, or in its own Workstream "#<id> <title>" once its claim lapsed; a Todo a run makes in
 * an item's Workstream is never one. The first claim moves the Todo into its own Workstream, and roundup holds no
 * claim an Ext could write, so the holder and expiry stay in hum's state. A question about a change that waits on the
 * owner first writes the item's shown handoff Pad, "#<id> handoff", which the question names. Finishing completes the
 * Todo, rewrites the handoff Pad as what merged and moves it to hum's Workstream, moves the Todo back where the owner
 * put it, and removes the item's Workstream with every row and other Pad in it. The thread is hum's own comments on
 * the Todo, the questions hum asked as rows, and each answer the owner gave in a row's AskUserQuestion after roundup
 * showed the row waiting on them, as the row's answer hook reported it; the owner answers only there, never in a Todo
 * comment or through `hum answer`. The watch follows roundup's Event log, and each change to an item or a question row
 * wakes the worker.
 */
export const roundupAdapter = (options: RoundupOptions, { now, env, report }: AdapterContext): Whole => {
	const socket = options.socket ?? env.RUPD_SOCKET;

	if (!socket) throw new PermanentError("the roundup adapter runs only where roundup serves the Project: RUPD_SOCKET is not set");

	const dirs = foldersOf(options.stateDir);

	const questionFolders = () =>
		listFiles(dirs.questions).flatMap((root) => {
			const asked = readJson(Asked, join(root, "question.json"));

			return asked ? [{ root, folder: runFolderAt(root), asked, row: readJson(RowRecord, runFolderAt(root).row)?.id }] : [];
		});

	type Asking = ReturnType<typeof questionFolders>[number];

	/** Whether an Event changes what hum reads: a Todo someone else changed, or the status of a question row, whose waiting on the owner it marks. */
	const isChange = ({ name, actor, data }: RoundupEvent): boolean => {
		if (name.startsWith("todo.")) return actor?.id !== HUM_EXT;

		const status = name === "agent.status" ? StatusEvent.safeParse(data).data : undefined;
		const asking = status && questionFolders().find(({ row }) => row === status.id);

		if (asking && status.status.kind === NEEDS_YOU) markAsked(asking.folder, status.status.since);

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

	/** A call on the item's Todo alone, so roundup's not-found means the owner deleted it, and hum lets go of the item. */
	const onTodo = (method: string, id: string, params: Record<string, Json> = {}): Promise<Json> =>
		call(method, { id: parseArgument(TodoId, id), ...params }).catch(async (error: Error) => {
			if (!(error instanceof RoundupRefusal && error.code === NOT_FOUND)) throw error;

			await letGo(id);

			throw new ItemGone(id, ROUNDUP);
		});

	const todoOf = async (id: string) => Todo.parse(await onTodo("todo.get", id));

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

	/** The open Todos of hum's Workstream whose id `keep` takes. */
	const openTodos = async (keep: (id: ItemId) => boolean): Promise<ItemRef[]> => {
		const [list, nodes] = await Promise.all([todos(), railTree(call)]);

		humWorkstream(nodes);

		return list.flatMap((todo): ItemRef[] => {
			const id = ItemId.parse(String(todo.id));

			return isOpen(todo, nodes) && keep(id) ? [{ id, title: todo.title }] : [];
		});
	};

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

	/** An item has one open question, the newest: asking another stops the rows of those before it. */
	const stopOpen = async (id: string): Promise<void> => {
		for (const open of questionsOf(id).filter((asking) => takenOf(asking) === undefined)) await stop(open.row);
	};

	/** Drops what hum keeps for the item and roundup holds for no Ext: its question folders and its claim. */
	const dropKept = (id: string): void => {
		for (const { root } of questionsOf(id)) rmSync(root, { recursive: true, force: true });

		rmSync(claimFile(id), { force: true });
	};

	/** Lets go of an item whose Todo the owner deleted: its open question rows stop, and what hum kept for it goes. */
	const letGo = async (id: string): Promise<void> => {
		await stopOpen(id);
		dropKept(id);
	};

	/**
	 * The owner's answer in the first report of a question row's answer hook from `since` on that holds one answer: what
	 * they picked or typed, and the option of hum's question it names. A report that holds none, or several, raises a card.
	 */
	const answerOf = (id: string, { folder, asked }: Asking, since: number): { readonly text: string; readonly option: string | undefined } | undefined => {
		const row = railName(asked.name);

		for (const { file, answers } of ownerAnswers(folder.hooks).filter(({ at }) => at >= since)) {
			const [text, ...more] = Object.values(answers ?? {});

			if (text !== undefined && more.length === 0) return { text, option: optionsIn(asked.text).find((option) => option.toLowerCase() === text.trim().toLowerCase()) };

			report({
				code: UNREAD_ANSWER_CODE,
				item: id,
				cause: answers === undefined ? `the row "${row}" reported your answer in a shape hum does not read: ${file}` : `the row "${row}" asked ${Object.keys(answers).length} questions in one dialog, so hum cannot tell your answer to its own`,
				fix: `Ask the row "${row}" to ask you hum's question again, alone.`,
			});
		}

		return undefined;
	};

	/** Whether a question's row asked the owner and then ended, as when they stopped it, with no answer hum took. */
	const endedUnanswered = (asking: Asking, nodes: readonly RailNode[]): boolean => {
		const node = nodes.find(({ id }) => id === asking.row);

		return asking.row !== undefined && takenOf(asking) === undefined && askedSince(asking.folder) !== undefined && (node === undefined || node.status?.kind === ENDED);
	};

	/** Takes each open question's answer the owner gave once roundup showed its row waiting on them, and stops the row; the newest question, where its row ended unanswered, is asked again in a new row. */
	const takeAnswers = async (id: string, nodes: readonly RailNode[]): Promise<void> => {
		for (const asking of questionsOf(id).filter((open) => takenOf(open) === undefined)) {
			const status = nodes.find((node) => node.id === asking.row)?.status;

			if (status?.kind === NEEDS_YOU && status.since !== undefined) markAsked(asking.folder, status.since);

			const since = askedSince(asking.folder);
			const answer = since === undefined ? undefined : answerOf(id, asking, since);

			if (answer === undefined) continue;

			atomicWrite(join(asking.root, "taken.json"), JSON.stringify({ ...answer, at: now() }));
			await stop(asking.row);
		}

		const newest = questionsOf(id).toSorted((one, other) => other.asked.at - one.asked.at)[0];

		if (newest !== undefined && endedUnanswered(newest, nodes)) await ask(ItemId.parse(id), questionOf(newest.asked.text), newest.asked.handoff);
	};

	const threadOf = async (id: string, nodes: readonly RailNode[]): Promise<ThreadEntry[]> => {
		await takeAnswers(id, nodes);

		const comments = z.array(Comment).parse(await onTodo("todo.comments", id));

		return [
			...comments.flatMap((comment): ThreadEntry[] => (comment.author.id === HUM_EXT ? [{ ...parseComment(comment.body, comment.created_at), author: "hum" }] : [])),
			...questionsOf(id).flatMap((asking): ThreadEntry[] => {
				const taken = takenOf(asking);

				return [{ kind: "question", text: asking.asked.text, at: asking.asked.at, author: "hum" }, ...(taken ? [{ kind: "answer", ...taken, author: "person" } as const] : [])];
			}),
		].sort((one, other) => one.at - other.at);
	};

	const post = async (id: string, text: string): Promise<void> => {
		await onTodo("todo.comment", id, { body: text });
	};

	/** Writes the item's handoff Pad, shown, as the change waits on the owner; a Pad this call made goes in the item's Workstream, and one that stood stays where it is, as the owner may have moved it. */
	const writeHandoff = async (id: string, { title, handoff, question, home }: { readonly title: string; readonly handoff: OwnerHandoff; readonly question: string; readonly home: string }): Promise<Linked> => {
		const [key, nodes] = await Promise.all([projectKeyOf(call), railTree(call)]);

		const rowLink = (name: string): string | undefined => {
			const row = nodes.find((node) => node.parent === home && node.name === railName(name));

			return row && agentLink(row.id, key);
		};

		const { pad, made } = await putPad(call, { name: handoffPadName(id), text: handoffText({ id, title, handoff, question, rowLink }), visibility: "shown" });

		if (made) await call("pad.move", { name: pad.name, home });

		return { name: pad.name, link: padLink(pad.name, key) };
	};

	/**
	 * Rewrites the item's handoff Pad as what merged and moves it to hum's Workstream, where removing the item's own
	 * keeps it, unless the owner moved it elsewhere; then one comment on the Todo names it with its link.
	 */
	const keepHandoff = async (todo: Todo, handoff: OwnerHandoff, nodes: readonly RailNode[]): Promise<void> => {
		const id = String(todo.id);
		const { pad, made } = await putPad(call, { name: handoffPadName(id), text: handoffText({ id, title: todo.title, handoff, rowLink: () => undefined }), visibility: "shown" });

		if (made || nodes.some((node) => node.id === pad.home && isItemWorkstream(id, node))) await call("pad.move", { name: pad.name, home: humOf(nodes)?.id ?? null });

		const line = `#${id} merged. What merged and what stays open: Pad "${pad.name}" ${padLink(pad.name, await projectKeyOf(call))}`;
		const comments = z.array(Comment).parse(await onTodo("todo.comments", id));

		if (!comments.some(({ author, body }) => author.id === HUM_EXT && body === line)) await post(id, line);
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

	/** A comment hum marks, on one line where it fits. */
	const postMarked = async (id: string, marker: Marker, text: string): Promise<void> => {
		const line = markedLine(marker, text);

		return isOneLine(line) ? post(id, line) : postInPad(id, marker, text);
	};

	/** Asks `question` in a new row, naming the handoff Pad an earlier asking of it wrote, else the one its own handoff writes now. */
	const ask = async (id: ItemId, question: Question, handoff?: Linked): Promise<void> => {
		const name = askName(id, questionsOf(id).length + 1);
		const root = join(dirs.questions, slug(name));
		const folder: RunFolder = runFolderAt(root);
		const todo = await todoOf(id);
		const workstream = await itemWorkstream(call, { id, title: todo.title });
		const pad = handoff ?? (question.handoff && (await writeHandoff(id, { title: todo.title, handoff: question.handoff, question: question.text, home: workstream })));

		/* The row's hooks write into this folder and do not make it. */
		mkdirSync(folder.hooks, { recursive: true });

		const request = { prompt: askPrompt(question, pad), cwd: options.repo, model: options.config.models.light, effort: QUESTION_EFFORT } as const;

		await stopOpen(id);

		const row = await startRow(call, { repo: options.repo, stateDir: options.stateDir, config: options.config }, { name, folder, request, answer: { by: "question" }, workstream });

		/* Asked when roundup started the row, on the clock its comments carry, so the thread keeps their order. */
		atomicWrite(join(root, "question.json"), JSON.stringify({ item: id, name, text: questionText(question), at: row.status?.since ?? now(), handoff: pad }));
	};

	return {
		apiVersion: ADAPTER_API_VERSION,
		spent: () => 0,
		close: async () => client.close(),
		workSource: {
			listReady: async () => openTodos(isFree),
			listClaimed: async (holder) => openTodos((id) => isHeldBy(standing(id)?.claim, holder, now())),
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
			finish: async (id, handoff) => {
				const todo = await todoOf(id);

				if (!todo.done) await call("todo.complete", { id: todo.id });

				const nodes = await railTree(call);

				if (handoff) await keepHandoff(todo, handoff, nodes);

				/* Only a Todo in its own Workstream goes back to the owner's, as removing that Workstream would delete it. */
				if (nodes.some((node) => node.id === todo.home && isItemWorkstream(id, node))) await call("todo.move", { id: todo.id, home: humOf(nodes)?.id ?? null });

				for (const node of nodes.filter((found) => isItemWorkstream(id, found)))
					await call("rail.remove", { id: node.id, scope: "all" }).catch((error: Error) => {
						if (!(error instanceof RoundupRefusal)) throw error;
					});

				dropKept(id);
			},
		},
		questions: {
			ask,
			decide: (id, text) => postMarked(id, { kind: "decision" }, text),
		},
		answers: {
			onlyToQuestions: true,
			/** On roundup a question is its row: the owner answers there, so an answer through hum is refused with the open row's link. */
			answer: async (id) => {
				const key = await projectKeyOf(call);

				const open = questionsOf(id)
					.filter((asking) => takenOf(asking) === undefined && asking.row !== undefined)
					.toSorted((one, other) => one.asked.at - other.asked.at)
					.at(-1);

				throw new PermanentError(open?.row !== undefined ? `On roundup the owner answers in the question's row: ${agentLink(open.row, key)}` : `On roundup the owner answers only in a question's row, and #${id} has no open question`);
			},
			/** A request is not an answer to a question row: hum posts it on the Todo as its own marked comment, which the thread reads as it reads hum's. */
			request: (id, request) => {
				const { marker, text } = requestEntry(request);

				return postMarked(id, marker, text);
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
