import { createServer, type Socket } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { JSONRPCClient, JSONRPCErrorException, JSONRPCServer, JSONRPCServerAndClient } from "json-rpc-2.0";
import { HUM_EXT } from "../../src/adapters/roundup-rpc.ts";
import { settleAtTestEnd, tempDir } from "./temp.ts";

/** roundup's JSON-RPC code for a subject that does not exist. */
const NOT_FOUND = -32001;

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
	const peers = new Map<Socket, JSONRPCServerAndClient>();
	const refusals = new Map<string, number>();
	let seq = 0;
	let nextId = 1;

	const todoOf = (id: Params["id"]): Todo => {
		const found = todos.get(Number(id));

		if (!found) throw new JSONRPCErrorException(`not found: todo ${id}`, NOT_FOUND);

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
				throw new JSONRPCErrorException(`not found: Agent "${id}"`, NOT_FOUND);
			},
		}),
	);

	const server = new JSONRPCServer({ errorListener: () => {} });

	for (const [name, served] of methods) server.addMethod(name, (params: Params | null) => served(params ?? {}));

	server.applyMiddleware((next, request, serverParams) => {
		const refused = refusals.get(request.method);

		calls.push({ method: request.method, params: request.params ?? {} });

		if (refused !== undefined) throw new JSONRPCErrorException(`refused ${request.method}`, refused);

		return next(request, serverParams);
	});

	const daemon = createServer((conn) => {
		const peer = new JSONRPCServerAndClient(server, new JSONRPCClient((request) => void conn.write(`${JSON.stringify(request)}\n`)));

		peers.set(conn, peer);
		conn.on("close", () => peers.delete(conn));
		createInterface({ input: conn }).on("line", (line) => void peer.receiveAndSend(JSON.parse(line), undefined, undefined));
	});

	await new Promise<void>((resolve) => daemon.listen(socket, resolve));

	const close = (): Promise<void> =>
		new Promise((resolve) => {
			for (const conn of peers.keys()) conn.destroy();

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

			for (const peer of peers.values()) peer.notify("event", event, undefined);
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
