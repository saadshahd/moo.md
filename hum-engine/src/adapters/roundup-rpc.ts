import { createConnection, type Socket } from "node:net";
import { createInterface } from "node:readline";
import { JSONRPCClient, JSONRPCErrorException, JSONRPCServer, JSONRPCServerAndClient } from "json-rpc-2.0";
import { z } from "zod";
import { Json } from "../config/json.ts";

/**
 * The name hum claims on roundup. A caller below the Project's program that claims a name is still the program where
 * roundup gates by the program (start settings, adoption), and is this Ext everywhere else, so a note or a Pad hum
 * writes shows as hum's, never as the owner's.
 */
export const HUM_EXT = "ext:hum";

/** The word roundup opens a refusal with, as `worktree_in_use` opens "worktree_in_use: <folder>". */
const REASON = /^([a-z]+(?:_[a-z]+)+): /u;

/**
 * A call roundup answered with an error: its JSON-RPC code, its message, which names the method and what roundup
 * refused, and the word roundup names that refusal by, where its words open with one.
 */
export class RoundupRefusal extends Error {
	override name = "RoundupRefusal";
	readonly reason: string | undefined;

	constructor(
		readonly code: number,
		method: string,
		said: string,
	) {
		super(`${method}: ${said}`);
		this.reason = REASON.exec(said)?.[1];
	}
}

/** One entry of roundup's Event log, numbered in the order the Daemon saved it. */
export const RoundupEvent = z.looseObject({ seq: z.int().nonnegative(), name: z.string(), actor: z.looseObject({ kind: z.string(), id: z.string() }).optional(), data: Json.optional() });

export type RoundupEvent = z.infer<typeof RoundupEvent>;

const Subscribed = z.looseObject({ head: z.int().nonnegative() });

export type RoundupCall = (method: string, params?: Record<string, Json>) => Promise<Json>;

export type RoundupClient = {
	readonly call: RoundupCall;
	/** Opens the connection where it is closed; a client that follows events is following again once it resolves. */
	readonly open: () => Promise<void>;
	/** The last Event this client handed over, else the head it began following from; undefined before it follows. */
	readonly position: () => number | undefined;
	/** Ends the connection for good: a later call fails, and opens none. */
	readonly close: () => void;
};

/** What a client that follows the Event log does with each Event, and the Event it follows on from, else the head. */
export type Follow = { readonly onEvent: (event: RoundupEvent) => void; readonly from?: number };

type Connection = { readonly conn: Socket; readonly peer: JSONRPCServerAndClient };

/** What one line from the Daemon holds: a reply or an event; a line that is no JSON holds nothing. */
const messageOf = (line: string): Json | undefined => {
	try {
		return Json.parse(JSON.parse(line));
	} catch {
		return undefined;
	}
};

/**
 * JSON-RPC on the Daemon's socket, one message per line, claiming the Ext name `ext`, or no name at all when it is
 * null. The connection opens at the first call and again at the next call after it drops; a call in flight when it
 * drops fails, and every call fails once the client is closed. With `follow`, each connection subscribes to the Event
 * log and hands every Event to it, each from the last one handed over, so no Event is missed across a drop.
 */
export const roundupRpc = (socket: string, ext: string | null = HUM_EXT, follow?: Follow): RoundupClient => {
	let open: Promise<Connection> | undefined;
	let seen = follow?.from;
	const closing = new AbortController();

	const handOver = (event: RoundupEvent): void => {
		seen = event.seq;
		follow?.onEvent(event);
	};

	const connect = (): Promise<Connection> =>
		new Promise((resolve, reject) => {
			const conn = createConnection(socket);
			const peer = new JSONRPCServerAndClient(new JSONRPCServer(), new JSONRPCClient((request) => void conn.write(`${JSON.stringify(request)}\n`)));

			peer.addMethod("event", (params) => {
				const event = RoundupEvent.safeParse(params);

				if (event.success) handOver(event.data);
			});

			createInterface({ input: conn }).on("line", (line) => {
				const message = messageOf(line);

				if (message !== undefined) void peer.receiveAndSend(message, undefined, undefined);
			});

			conn.on("close", () => {
				open = undefined;
				peer.rejectAllPendingRequests(`roundup's socket ${socket} closed`);
			});
			conn.once("error", reject);
			conn.once("connect", () => {
				const identified = ext === null ? Promise.resolve() : peer.request("daemon.identify", { actor: { kind: "ext", id: ext, parent: null } }, undefined);
				const subscribed = async (after: number | undefined) => Subscribed.parse(await peer.request("events.subscribe", after === undefined ? {} : { after }, undefined)).head;

				/* A log that no longer reaches `seen`, as after its data folder changed, is followed from its head. */
				const followed = async () => {
					if (!follow) return;

					const head = await subscribed(seen).catch((error: Error) => {
						if (seen === undefined || !(error instanceof JSONRPCErrorException)) throw error;

						seen = undefined;

						return subscribed(undefined);
					});

					seen ??= head;
				};

				Promise.resolve(identified)
					.then(followed)
					.then(() => resolve({ conn, peer }), reject);
			});
		});

	const opened = async (): Promise<Connection> => {
		closing.signal.throwIfAborted();

		return (open ??= connect().catch((error: Error) => {
			open = undefined;

			throw error;
		}));
	};

	const call: RoundupCall = async (method, params) => {
		const { peer } = await opened();

		try {
			return Json.parse((await peer.request(method, params ?? null, undefined)) ?? null);
		} catch (error) {
			if (error instanceof JSONRPCErrorException) throw new RoundupRefusal(error.code, method, error.message);

			throw error;
		}
	};

	return {
		call,
		open: async () => void (await opened()),
		position: () => seen,
		close: () => {
			closing.abort(new Error(`the client of roundup's socket ${socket} is closed`));
			void open?.then(({ conn }) => conn.end(), () => {});
			open = undefined;
		},
	};
};
