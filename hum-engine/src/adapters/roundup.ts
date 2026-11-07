import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import {
	type Adapter,
	type AdapterContext,
	type Answers,
	type Claim,
	type ClaimResult,
	type FollowUp,
	type Item,
	ItemId,
	type ItemRef,
	PermanentError,
	type Questions,
	type WorkSource,
	type Watch,
} from "../adapter-api.ts";
import { answerMarker, type Marker, markedLine, markerOf, parseComment, questionMarker, splitMarker } from "./marked.ts";
import { Json } from "../config/json.ts";

const CLAIM_OPEN = "<!-- hum-claim ";

/** An Agent's comment on a Todo is one line of at most 280 characters. */
const COMMENT_LIMIT = 280;

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

const Todos = z.union([
	z.array(Todo),
	z.looseObject({ todos: z.array(Todo) }).transform((found) => found.todos),
]);

const Reply = z.looseObject({
	content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).optional(),
	isError: z.boolean().optional(),
	structuredContent: Json.optional(),
});

const environment = () => Object.fromEntries(Object.entries(process.env).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])));

const Comment = z.looseObject({
	id: z.int().nonnegative(),
	body: z.string(),
	created_at: z.number(),
});

/** One take or renewal of an item's claim, written as a comment. */
const ClaimEntry = z.strictObject({
	holder: z.string().min(1),
	at: z.int().nonnegative(),
	expiresAt: z.int().nonnegative(),
});

type ClaimEntry = z.infer<typeof ClaimEntry>;

/** Calls one tool of roundup's MCP server and returns its parsed JSON. A tool that reports an error throws a `PermanentError`. */
export type ToolCall = (tool: string, args: Record<string, Json>) => Promise<Json>;

export type RoundupOptions = {
	/** Replaces the stdio client, for a stub. */
	readonly call?: ToolCall;
	/** The Agent id `rup mcp` acts as. Defaults to `ROUNDUP_AGENT_ID`. */
	readonly agent?: string;
	/** The Project's daemon socket. Defaults to `RUPD_SOCKET`. */
	readonly socket?: string;
};

const claimOf = (body: string): ClaimEntry | undefined => {
	const split = splitMarker(body, CLAIM_OPEN);

	try {
		return split ? ClaimEntry.parse(JSON.parse(split.json)) : undefined;
	} catch {
		return undefined;
	}
};

/**
 * The claim that stands after the comments' order: a take wins if none stands or the standing claim ended before it was made;
 * the holder's own later entry renews. Comments are ordered by the daemon, so every worker folds the same list to the same winner.
 */
const standing = (
	comments: readonly z.infer<typeof Comment>[],
): ClaimEntry | undefined => {
	let current: ClaimEntry | undefined;

	for (const comment of comments) {
		const entry = claimOf(comment.body);

		if (!entry) continue;

		if (
			!current ||
			current.expiresAt <= entry.at ||
			current.holder === entry.holder
		)
			current = entry;
	}

	return current;
};

/** The stdio client: `rup mcp <agent>` on the Project's socket. Only a run roundup started has both. */
export const stdioCall = ({
	agent,
	socket,
}: RoundupOptions) => {
	const who = agent ?? process.env.ROUNDUP_AGENT_ID;
	const path = socket ?? process.env.RUPD_SOCKET;
	let client: Promise<Client> | undefined;

	if (!who || !path)
		throw new PermanentError(
			"the roundup adapter runs only in a run roundup started: ROUNDUP_AGENT_ID and RUPD_SOCKET are not both set",
		);

	const connect = async () => {
		const made = new Client({ name: "hum", version: "0" });

		await made.connect(
			new StdioClientTransport({
				command: "rup",
				args: ["mcp", who],
				env: { ...environment(), RUPD_SOCKET: path },
			}),
		);

		return made;
	};

	const call: ToolCall = async (tool, args) => {
		const used = (client ??= connect());

		const result = await used
			.then((live) => live.callTool({ name: tool, arguments: args }))
			.catch((error: Error) => {
				client = undefined;

				throw error;
			});

		const reply = Reply.parse(result);
		const text = reply.content?.find((part) => part.type === "text")?.text ?? "";

		if (reply.isError)
			throw new PermanentError(`${tool}: ${text.slice(0, 300)}`);

		if (reply.structuredContent !== undefined) return reply.structuredContent;

		try {
			return text === "" ? null : Json.parse(JSON.parse(text));
		} catch {
			return text;
		}
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

type Whole = Adapter & {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly answers: Answers;
	/** Always 0: roundup's socket is local and has no rate limit. */
	readonly spent: () => number;
	readonly close: () => Promise<void>;
};

/**
 * roundup as a work source, through its MCP server over stdio: Todos are items and their comments are the thread.
 * A Todo is ready while it is open, unblocked, unassigned and holds no live claim. A claim is a comment (`<!-- hum-claim {json} -->`),
 * so the daemon's comment order picks the winner. Roundup has no release step, so there is no `release`.
 */
export const roundupAdapter = (
	options: RoundupOptions,
	{ now }: AdapterContext,
): Whole => {
	const client = options.call ? { call: options.call, close: async () => {} } : stdioCall(options);
	const { call } = client;

	const numberOf = (id: string): number => {
		ItemId.parse(id);

		if (!/^(0|[1-9]\d*)$/.test(id))
			throw new PermanentError(`"${id}" is no roundup Todo id`);

		return Number(id);
	};

	const comments = async (id: string) =>
		Comment.array().parse(await call("todo_comments", { id: numberOf(id) }));

	const todo = async (id: string) =>
		Todo.parse(await call("todo_get", { id: numberOf(id) }));

	const line = (marker: Marker, text: string) => markedLine(marker, text, COMMENT_LIMIT);

	const post = (id: string, text: string) => {
		if (text.includes("\n") || text.length > COMMENT_LIMIT)
			throw new PermanentError(
				`a roundup comment is one line of at most ${COMMENT_LIMIT} characters`,
			);

		return call("todo_comment", { id: numberOf(id), body: text });
	};

	const live = (claim: ClaimEntry | undefined): claim is ClaimEntry =>
		claim !== undefined && claim.expiresAt > now();

	const asClaim = (id: string, entry: ClaimEntry): Claim => ({
		item: id,
		holder: entry.holder,
		expiresAt: entry.expiresAt,
	});

	const take = async (
		id: string,
		holder: string,
		ttlMs: number,
		renew: boolean,
	): Promise<ClaimResult> => {
		if (!Number.isInteger(ttlMs) || ttlMs <= 0)
			throw new PermanentError(
				`a claim lasts a positive whole number of milliseconds, not ${ttlMs}`,
			);

		if (!/^[A-Za-z0-9][\w.@:-]{0,99}$/.test(holder))
			throw new PermanentError(`holder "${holder}" is not a plain name`);

		const found = await todo(id);
		const current = standing(await comments(id));

		if (live(current) && current.holder !== holder)
			return { won: false, claim: asClaim(id, current) };

		if (renew && current?.holder !== holder) {
			if (current) return { won: false, claim: asClaim(id, current) };

			throw new PermanentError(`"${holder}" holds no claim on "${id}"`);
		}

		if (!current && (found.done || found.blocked || found.owner))
			throw new PermanentError(
				`Todo ${id} is not open, unblocked and unassigned`,
			);

		const at = now();
		const entry: ClaimEntry = { holder, at, expiresAt: at + ttlMs };

		await post(
			id,
			`${CLAIM_OPEN}${JSON.stringify(entry)} --> claimed by ${holder}`,
		);

		const winner = standing(await comments(id));

		if (!winner)
			throw new PermanentError(
				`claim on "${id}" vanished after it was written`,
			);

		return { won: winner.holder === holder, claim: asClaim(id, winner) };
	};

	const threadOf = (list: readonly z.infer<typeof Comment>[]) =>
		list.flatMap((comment) => (claimOf(comment.body) === undefined ? [parseComment(comment.body, comment.created_at)] : []));

	const adapter: Whole = {
		apiVersion: 1,
		spent: () => 0,
		close: client.close,
		workSource: {
			async listReady() {
				const open = Todos.parse(await call("todo_list", {})).filter(
					(found) => !found.done && !found.blocked && !found.owner,
				);

				const ready: ItemRef[] = [];

				for (const found of open) {
					const id = String(found.id);

					if (!live(standing(await comments(id))))
						ready.push({ id, title: found.title });
				}

				return ready;
			},
			async read(id): Promise<Item> {
				const found = await todo(id);
				const list = await comments(id);

				return {
					id,
					title: found.title,
					body: found.body,
					ready:
						!found.done &&
						!found.blocked &&
						!found.owner &&
						!live(standing(list)),
					thread: threadOf(list),
				};
			},
			claim: (id, holder, ttlMs) => take(id, holder, ttlMs, false),
			renew: (id, holder, ttlMs) => take(id, holder, ttlMs, true),
			async comment(id, text) {
				await post(id, text.trim() === "" ? "(empty)" : text.trim());
			},
			async fileFollowUp(
				from: string,
				{ title, body }: FollowUp,
			): Promise<ItemRef> {
				const key = createHash("sha256")
					.update(title)
					.digest("hex")
					.slice(0, 12);

				const filed = (await comments(from)).flatMap((comment) => {
					const follow = markerOf(comment.body)?.followUp;

					return follow?.key === key ? [follow.item] : [];
				});

				if (filed[0] !== undefined) return { id: filed[0], title };

				const made = Todo.parse(
					await call("todo_create", {
						title,
						body: `${body.trim()}\n\nFiled from #${from}.`,
					}),
				);

				await post(
					from,
					line(
						{ kind: "comment", followUp: { key, item: String(made.id) } },
						`Filed follow-up #${made.id}: ${title}`,
					),
				);

				return { id: String(made.id), title };
			},
		},
		questions: {
			ask: async (id, { text, options }) =>
				void (await post(
					id,
					line(
						questionMarker(options),
						options?.length
							? `${text}\n\nOptions: ${options.join(", ")}`
							: text,
					),
				)),
			decide: async (id, text) =>
				void (await post(id, line({ kind: "decision" }, text))),
		},
		answers: {
			answer: async (id, { text, option }) =>
				void (await post(
					id,
					line(
						answerMarker(option),
						text,
					),
				)),
			/** Comments are no Todo Change, so the token hashes each open Todo's `updated_at` and comment ids. The socket is local: none of it spends rate limit. */
			async watch(since?: string): Promise<Watch> {
				const open = Todos.parse(await call("todo_list", {}));
				const parts: unknown[] = [];

				for (const found of open) {
					parts.push([
						found.id,
						found.updated_at,
						found.done,
						found.owner?.id ?? null,
					]);

					if (!found.done)
						parts.push(
							(await comments(String(found.id))).map((comment) => comment.id),
						);
				}

				const token = createHash("sha256")
					.update(JSON.stringify(parts))
					.digest("hex")
					.slice(0, 32);

				return { token, changed: token !== since };
			},
		},
	};

	return adapter;
};
