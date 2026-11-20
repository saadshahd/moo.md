import { createConnection, type Socket } from "node:net";
import { createInterface } from "node:readline";
import { isJSONRPCResponse, JSONRPCClient, JSONRPCErrorException } from "json-rpc-2.0";
import { Json } from "../config/json.ts";

/**
 * The name hum claims on roundup. A caller below the Project's program that claims a name is still the program where
 * roundup gates by the program (start settings, adoption), and is this Ext everywhere else, so a note or a Pad hum
 * writes shows as hum's, never as the owner's.
 */
export const HUM_EXT = "ext:hum";

/** A call roundup answered with an error: its JSON-RPC code and its message, which names what it refused. */
export class RoundupRefusal extends Error {
	override name = "RoundupRefusal";

	constructor(
		readonly code: number,
		message: string,
	) {
		super(message);
	}
}

export type RoundupCall = (method: string, params?: Record<string, Json>) => Promise<Json>;

export type RoundupClient = { readonly call: RoundupCall; readonly close: () => void };

type Connection = { readonly conn: Socket; readonly client: JSONRPCClient };

/** One reply line from the Daemon; a line that is no JSON-RPC reply, such as an event, says nothing to a caller. */
const replyOf = (line: string) => {
	try {
		const parsed: unknown = JSON.parse(line);

		return isJSONRPCResponse(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
};

const connect = (socket: string, ext: string | null, dropped: () => void): Promise<Connection> =>
	new Promise((resolve, reject) => {
		const conn = createConnection(socket);
		const client = new JSONRPCClient((request) => void conn.write(`${JSON.stringify(request)}\n`));

		createInterface({ input: conn }).on("line", (line) => {
			const reply = replyOf(line);

			if (reply) client.receive(reply);
		});

		conn.on("close", () => {
			dropped();
			client.rejectAllPendingRequests(`roundup's socket ${socket} closed`);
		});
		conn.once("error", reject);
		conn.once("connect", () => {
			if (ext === null) return resolve({ conn, client });

			client.request("daemon.identify", { actor: { kind: "ext", id: ext, parent: null } }).then(() => resolve({ conn, client }), reject);
		});
	});

/**
 * JSON-RPC on the Daemon's socket, one request per line, claiming the Ext name `ext`, or no name at all when it is
 * null. The connection opens at the first call and again at the next call after it drops; a call in flight when
 * it drops fails.
 */
export const roundupRpc = (socket: string, ext: string | null = HUM_EXT): RoundupClient => {
	let open: Promise<Connection> | undefined;

	const opened = (): Promise<Connection> =>
		(open ??= connect(socket, ext, () => {
			open = undefined;
		}).catch((error: Error) => {
			open = undefined;

			throw error;
		}));

	const call: RoundupCall = async (method, params) => {
		const { client } = await opened();

		try {
			return Json.parse((await client.request(method, params ?? null)) ?? null);
		} catch (error) {
			if (error instanceof JSONRPCErrorException) throw new RoundupRefusal(error.code, `${method}: ${error.message}`);

			throw error;
		}
	};

	return {
		call,
		close: () => {
			void open?.then(({ conn }) => conn.end(), () => {});
			open = undefined;
		},
	};
};
