import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { ADAPTER_API_VERSION, type AdapterContext, type Answers, Holder, type Integrations, type Item, ItemId, PermanentError, type Questions, type Watch, type WorkSource } from "../adapter-api.ts";
import { hashJson } from "../config/hash.ts";
import { Json } from "../config/json.ts";
import type { HumConfig } from "../config/schema.ts";
import type { Env } from "../exec.ts";
import { parseArgument } from "./argument.ts";
import { claimer, isLive } from "./claim.ts";
import {
	answerMarker,
	commentText,
	filedFollowUp,
	followUpBody,
	followUpNote,
	isFollowUpOf,
	type Marker,
	cutLine,
	markedLine,
	markerLine,
	parseComment,
	parseLooseJson,
	questionMarker,
	questionText,
	splitMarker,
} from "./marked.ts";

/** The name `hum.json` gives the roundup adapter. */
export const ROUNDUP = "roundup";

/** Whether any slot `integrations` names is served by roundup. */
export const doesUseRoundup = (integrations: HumConfig["integrations"]): boolean => Object.values(integrations ?? {}).includes(ROUNDUP);

const CLAIM_OPEN = "<!-- hum-claim ";

/** The Actor kind of an Agent, as a Todo's owner names it. */
const AGENT = "agent";

/** An Agent's comment on a Todo is one line of at most this many characters. */
const COMMENT_LIMIT = 280;

/** The digest in a Pad's name, so the same text posts to the same Pad name. */
const PAD_DIGEST_LENGTH = 8;

const TodoId = ItemId.refine((id) => /^(0|[1-9]\d*)$/.test(id), "a roundup Todo id is a whole number").transform(Number);

const Actor = z.looseObject({ kind: z.string(), id: z.string() });

const Todo = z.looseObject({
	id: z.int().nonnegative(),
	title: z.string(),
	body: z.string(),
	done: z.boolean(),
	blocked: z.boolean(),
	updated_at: z.number().optional(),
	owner: Actor.nullable().optional(),
});

type Todo = z.infer<typeof Todo>;

const Todos = z.union([z.array(Todo), z.looseObject({ todos: z.array(Todo) }).transform((found) => found.todos)]);

const Comment = z.looseObject({ id: z.int().nonnegative(), body: z.string(), created_at: z.number() });

type Comment = z.infer<typeof Comment>;

const Reply = z.looseObject({
	content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).optional(),
	isError: z.boolean().optional(),
	structuredContent: Json.optional(),
});

/** One take or renewal of an item's claim, written as a comment. */
const ClaimEntry = z.object({ holder: Holder, at: z.int().nonnegative(), expiresAt: z.int().nonnegative() });

type ClaimEntry = z.infer<typeof ClaimEntry>;

/** Calls one tool of roundup's MCP server and returns its parsed JSON. A tool that reports an error throws a `PermanentError`. */
export type ToolCall = (tool: string, args: Record<string, Json>) => Promise<Json>;

export type RoundupOptions = {
	/** Replaces the stdio client, for a stub. */
	readonly call?: ToolCall;
	/** The Agent hum acts as: `rup mcp` serves as it, and the Todos it owns are hum's work. Defaults to `ROUNDUP_AGENT_ID`. */
	readonly agent?: string;
	/** The Project's daemon socket. Defaults to `RUPD_SOCKET`. */
	readonly socket?: string;
};

const defined = (env: Env): Record<string, string> => Object.fromEntries(Object.entries(env).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])));

/** A tool's reply: its structured content, else its text as JSON, else the text itself. */
const replyValue = (tool: string, result: Awaited<ReturnType<Client["callTool"]>>): Json => {
	const reply = Reply.parse(result);
	const text = reply.content?.find((part) => part.type === "text")?.text ?? "";

	if (reply.isError) throw new PermanentError(`${tool}: ${text.slice(0, 300)}`);

	if (reply.structuredContent !== undefined) return reply.structuredContent;

	const json = parseLooseJson(Json, text);

	return json === undefined ? text : json;
};

/** The Agent hum acts as. A Terminal roundup starts for a program carries no Agent id, so hum's start command sets `ROUNDUP_AGENT_ID` itself. */
const agentOf = ({ agent }: RoundupOptions, env: Env): string => {
	const who = agent ?? env.ROUNDUP_AGENT_ID;

	if (!who) throw new PermanentError("the roundup adapter acts as one Agent, and ROUNDUP_AGENT_ID is not set: start hum with the command `hum setup write` printed");

	return who;
};

/** The stdio client: `rup mcp <agent>` on the Project's socket, which only a Terminal roundup started holds. */
export const stdioCall = (options: RoundupOptions, env: Env) => {
	const who = agentOf(options, env);
	const path = options.socket ?? env.RUPD_SOCKET;
	let client: Promise<Client> | undefined;

	if (!path) throw new PermanentError("the roundup adapter runs only in a Terminal roundup started: RUPD_SOCKET is not set");

	const connect = async () => {
		const made = new Client({ name: "hum", version: "0" });

		await made.connect(new StdioClientTransport({ command: "rup", args: ["mcp", who], env: { ...defined(env), RUPD_SOCKET: path } }));

		return made;
	};

	const call: ToolCall = async (tool, args) => {
		const result = await (client ??= connect())
			.then((live) => live.callTool({ name: tool, arguments: args }))
			.catch((cause: unknown) => {
				client = undefined;

				throw cause;
			});

		return replyValue(tool, result);
	};

	return {
		call,
		close: async () => {
			const used = client;

			client = undefined;
			await (await used)?.close();
		},
	};
};

const claimEntryOf = (body: string): ClaimEntry | undefined => {
	const split = splitMarker(body, CLAIM_OPEN);

	return split && parseLooseJson(ClaimEntry, split.json);
};

/** A later entry takes over when no claim stands, the standing one ended before it was made, or its holder renews. */
const doesTakeOver = (current: ClaimEntry | undefined, entry: ClaimEntry): boolean => !current || current.expiresAt <= entry.at || current.holder === entry.holder;

/** The claim that stands after the comments' order. The daemon orders comments, so every worker folds the same list to the same winner. */
const standingEntry = (comments: readonly Comment[]): ClaimEntry | undefined =>
	comments.reduce<ClaimEntry | undefined>((current, comment) => {
		const entry = claimEntryOf(comment.body);

		return entry && doesTakeOver(current, entry) ? entry : current;
	}, undefined);

/** Open, unblocked and owned by `agent`: a Todo's owner hands it to hum by assigning it to hum's Agent. */
const isOpenFor =
	(agent: string) =>
	(todo: Todo): boolean =>
		!todo.done && !todo.blocked && todo.owner?.kind === AGENT && todo.owner.id === agent;

const doesFitOneComment = (text: string): boolean => !text.includes("\n") && text.length <= COMMENT_LIMIT;

type Whole = Integrations & {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly answers: Answers;
	/** Always 0: roundup's socket is local and has no rate limit. */
	readonly spent: () => number;
	readonly close: () => Promise<void>;
};

/**
 * roundup as a work source, through its MCP server over stdio: Todos are items and their comments are the thread.
 * A Todo is ready while it is open, unblocked, owned by hum's Agent and holds no live claim; a follow-up hum files is
 * owned by that Agent, so it is ready at once. A claim is a comment, so the daemon's comment order picks the winner.
 * roundup has no release step.
 */
export const roundupAdapter = (options: RoundupOptions, { now, env }: AdapterContext): Whole => {
	const agent = agentOf(options, env);
	const client = options.call ? { call: options.call, close: async () => {} } : stdioCall({ ...options, agent }, env);
	const { call } = client;
	const isOpenToTake = isOpenFor(agent);

	const comments = async (id: string) => Comment.array().parse(await call("todo_comments", { id: parseArgument(TodoId, id) }));

	const todo = async (id: string) => Todo.parse(await call("todo_get", { id: parseArgument(TodoId, id) }));

	const todos = async () => Todos.parse(await call("todo_list", {}));

	const post = async (id: string, text: string): Promise<void> => {
		if (!doesFitOneComment(text)) throw new PermanentError(`a roundup comment is one line of at most ${COMMENT_LIMIT} characters`);

		await call("todo_comment", { id: parseArgument(TodoId, id), body: text });
	};

	/** A text too long for one comment goes whole into a Pad; the comment holds its first words and the Pad's name. */
	const postInPad = async (id: string, marker: Marker | undefined, text: string): Promise<void> => {
		const name = `hum ${id} ${hashJson(text).slice(0, PAD_DIGEST_LENGTH)}`;

		await call("pad_create", { name, text });
		await post(id, cutLine(marker, text, ` … full text in Pad "${name}"`, COMMENT_LIMIT));
	};

	const postMarked = async (id: string, marker: Marker, text: string): Promise<void> => {
		const line = markedLine(marker, text);

		return line.length <= COMMENT_LIMIT ? post(id, line) : postInPad(id, marker, text);
	};

	const postPlain = async (id: string, text: string): Promise<void> => (doesFitOneComment(text) ? post(id, text) : postInPad(id, undefined, text));

	const standingClaim = (id: ItemId, list: readonly Comment[]) => {
		const entry = standingEntry(list);

		return entry && { claim: { item: id, holder: entry.holder, expiresAt: entry.expiresAt } };
	};

	const isFree = (id: ItemId, list: readonly Comment[]): boolean => !isLive(standingClaim(id, list)?.claim, now());

	const take = claimer(
		{
			standing: async (id) => standingClaim(id, await comments(id)),
			isReady: async (id) => isOpenToTake(await todo(id)),
			write: async (claim) => {
				const entry: ClaimEntry = { holder: claim.holder, at: now(), expiresAt: claim.expiresAt };

				await post(claim.item, `${markerLine(ClaimEntry, entry, CLAIM_OPEN)} claimed by ${claim.holder}`);

				return standingEntry(await comments(claim.item))?.holder === claim.holder;
			},
		},
		now,
	);

	const threadOf = (list: readonly Comment[]) => list.flatMap((comment) => (claimEntryOf(comment.body) === undefined ? [parseComment(comment.body, comment.created_at)] : []));

	/** What `watch` hashes for one Todo. Comments are no Todo change, so each open Todo's comment ids count too. */
	const watchedParts = async (found: Todo): Promise<Json> => ({
		id: found.id,
		updatedAt: found.updated_at ?? null,
		done: found.done,
		owner: found.owner?.id ?? null,
		comments: found.done ? [] : (await comments(String(found.id))).map((comment) => comment.id),
	});

	return {
		apiVersion: ADAPTER_API_VERSION,
		spent: () => 0,
		close: client.close,
		workSource: {
			listReady: async () => {
				const open = (await todos()).filter(isOpenToTake).map((found) => ({ id: ItemId.parse(String(found.id)), title: found.title }));
				const free = await Promise.all(open.map(async ({ id }) => isFree(id, await comments(id))));

				return open.filter((_, index) => free[index]);
			},
			read: async (id): Promise<Item> => {
				const [found, list] = await Promise.all([todo(id), comments(id)]);

				return { id, title: found.title, body: found.body, ready: isOpenToTake(found) && isFree(id, list), thread: threadOf(list) };
			},
			claim: (id, holder, ttlMs) => take("claim", parseArgument(ItemId, id), holder, ttlMs),
			renew: (id, holder, ttlMs) => take("renew", parseArgument(ItemId, id), holder, ttlMs),
			comment: (id, text) => postPlain(id, commentText(text)),
			fileFollowUp: async (from, { title, body }) => {
				const filed = filedFollowUp((await comments(from)).map((comment) => comment.body), title);

				if (filed !== undefined) return { id: filed, title };

				const created = async () => Todo.parse(await call("todo_create", { title, body: followUpBody(body, `#${from}`), owner: { kind: AGENT, id: agent } })).id;
				const id = ItemId.parse(String((await todos()).find(isFollowUpOf(`#${from}`, title))?.id ?? (await created())));
				const note = followUpNote(title, id);

				await postMarked(from, note.marker, note.text);

				return { id, title };
			},
			finish: async (id) => {
				if (!(await todo(id)).done) await call("todo_complete", { id: parseArgument(TodoId, id) });
			},
		},
		questions: {
			ask: (id, question) => postMarked(id, questionMarker(question.options), questionText(question)),
			decide: (id, text) => postMarked(id, { kind: "decision" }, text),
		},
		answers: {
			answer: (id, { text, option }) => postMarked(id, answerMarker(option), text),
			/** The socket is local: none of this spends rate limit. */
			watch: async (since?: string): Promise<Watch> => {
				const token = hashJson(await Promise.all((await todos()).map(watchedParts)));

				return { token, changed: token !== since };
			},
		},
	};
};
