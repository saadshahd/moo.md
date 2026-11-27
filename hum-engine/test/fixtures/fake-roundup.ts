import { createServer, type Socket } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { HUM_EXT } from "../../src/adapters/roundup-rpc.ts";
import type { Json } from "../../src/config/json.ts";
import { settleAtTestEnd, tempDir } from "./temp.ts";

/** roundup's JSON-RPC codes for a subject that does not exist and for a method it does not serve. */
const NOT_FOUND = -32001;
const NO_METHOD = -32601;

class Refusal extends Error {
	constructor(
		readonly code: number,
		message: string,
	) {
		super(message);
	}
}

type Todo = { id: number; title: string; body: string; done: boolean; blocked: boolean; home: string | null };

type Node = { id: string; name: string; kind: string; parent: string | null };

type Comment = { author: { id: string }; body: string; created_at: number };

type Params = { id?: number | string; title?: string; body?: string; home?: string | null; name?: string };

/** One method the Daemon serves: what it answers `params` with. */
type Method = (params: Params) => object;

/**
 * roundup's Daemon on a Unix socket, holding the Todos, Workstreams and comments hum's roundup adapter reads, as the
 * Daemon answers it: a Todo, Agent or node it does not hold is refused as not found. Every call is kept, in order.
 */
export const fakeRoundup = async () => {
	const socket = join(tempDir("roundup"), "rupd.sock");
	const todos = new Map<number, Todo>();
	const nodes: Node[] = [];
	const comments = new Map<number, Comment[]>();
	const calls: { readonly method: string; readonly params: Params }[] = [];
	const conns = new Set<Socket>();
	const refusals = new Map<string, number>();
	let seq = 0;
	let nextId = 1;

	const todoOf = (id: Params["id"]): Todo => {
		const found = todos.get(Number(id));

		if (!found) throw new Refusal(NOT_FOUND, `not found: todo ${id}`);

		return found;
	};

	const workstream = (name: string): Node => {
		const node = { id: String(nextId++), name, kind: "workstream", parent: null };

		nodes.push(node);

		return node;
	};

	const create = (title: string, body = "", home: string | null = null): Todo => {
		const todo = { id: nextId++, title, body, done: false, blocked: false, home };

		todos.set(todo.id, todo);

		return todo;
	};

	const methods = new Map<string, Method>(
		Object.entries({
			"daemon.identify": () => ({}),
			"daemon.ping": () => ({ projectKey: "fake" }),
			"events.subscribe": () => ({ head: seq }),
			"rail.tree": () => nodes,
			"rail.createWorkstream": ({ name = "" }) => workstream(name),
			"todo.list": () => [...todos.values()],
			"todo.get": ({ id }) => todoOf(id),
			"todo.create": ({ title = "", body }) => create(title, body),
			"todo.move": ({ id, home = null }) => Object.assign(todoOf(id), { home }),
			"todo.complete": ({ id }) => Object.assign(todoOf(id), { done: true }),
			"todo.comments": ({ id }) => comments.get(todoOf(id).id) ?? [],
			"todo.comment": ({ id, body = "" }) => {
				const todo = todoOf(id);

				comments.set(todo.id, [...(comments.get(todo.id) ?? []), { author: { id: HUM_EXT }, body, created_at: Date.now() }]);

				return {};
			},
			"agent.stop": ({ id }) => {
				throw new Refusal(NOT_FOUND, `not found: Agent "${id}"`);
			},
		}),
	);


	const answer = (method: string, params: Params): Json => {
		const served = methods.get(method);
		const refused = refusals.get(method);

		if (refused !== undefined) throw new Refusal(refused, `refused ${method}`);

		if (!served) throw new Refusal(NO_METHOD, `method not found: ${method}`);

		return JSON.parse(JSON.stringify(served(params) ?? null));
	};

	const daemon = createServer((conn) => {
		conns.add(conn);
		conn.on("close", () => conns.delete(conn));
		createInterface({ input: conn }).on("line", (line) => {
			const { id, method, params } = JSON.parse(line);

			calls.push({ method, params: params ?? {} });

			try {
				conn.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: answer(method, params ?? {}) })}\n`);
			} catch (error) {
				const { code, message } = error instanceof Refusal ? error : new Refusal(-32603, String(error));

				conn.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
			}
		});
	});

	await new Promise<void>((resolve) => daemon.listen(socket, resolve));

	const close = (): Promise<void> =>
		new Promise((resolve) => {
			for (const conn of conns) conn.destroy();

			daemon.close(() => resolve());
		});

	settleAtTestEnd(close);

	return {
		socket,
		calls,
		workstream,
		/** A Todo in the Workstream `home`, as the owner files it. */
		todo: (title: string, home: Node, body = "") => String(create(title, body, home.id).id),
		/** Deletes the Todo as removing its Workstream does, and tells every follower. */
		remove: (id: string) => {
			todos.delete(Number(id));
			comments.delete(Number(id));

			const event = { seq: ++seq, name: "todo.deleted", actor: { kind: "user", id: "owner" }, data: { id: Number(id) } };

			for (const conn of conns) conn.write(`${JSON.stringify({ jsonrpc: "2.0", method: "event", params: event })}\n`);
		},
		/** How many calls of `method` named the Todo `id`. */
		callsOn: (method: string, id: string) => calls.filter((call) => call.method === method && String(call.params.id) === id).length,
		/** Refuses every call of `method` with `code`. */
		refuse: (method: string, code: number) => void refusals.set(method, code),
		/** Stops answering, as a Daemon that went down. */
		close,
	};
};

export type FakeRoundup = Awaited<ReturnType<typeof fakeRoundup>>;
