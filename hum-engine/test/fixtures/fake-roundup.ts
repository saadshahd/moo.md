import { createServer, type Socket } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { JSONRPCClient, JSONRPCErrorException, JSONRPCServer, JSONRPCServerAndClient } from "json-rpc-2.0";
import { HUM_EXT } from "../../src/adapters/roundup-rpc.ts";
import { settleAtTestEnd, tempDir } from "./temp.ts";

/** roundup's JSON-RPC code for a subject that does not exist. */
const NOT_FOUND = -32001;

type Todo = { id: number; title: string; body: string; done: boolean; blocked: boolean; home: string | null };

type Node = { id: string; name: string; kind: string; parent: string | null; status?: { kind: string; since: number } };

type Comment = { author: { id: string }; body: string; created_at: number };

type Params = { id?: number | string; title?: string; body?: string; home?: string | null; name?: string; parent?: string; text?: string };

/** One method the Daemon serves: what it answers `params` with. */
type Method = (params: Params) => object;

/**
 * roundup's Daemon on a Unix socket, holding the Todos, Workstreams, comments and question rows hum's roundup adapter
 * reads, as the Daemon answers it: a Todo, Agent or node it does not hold is refused as not found. A row starts
 * working and runs nothing. Every call is kept, in order.
 */
export const fakeRoundup = async () => {
	const socket = join(tempDir("roundup"), "rupd.sock");
	const todos = new Map<number, Todo>();
	const nodes: Node[] = [];
	const comments = new Map<number, Comment[]>();
	const pads = new Map<string, { name: string; text: string; home: string | null }>();
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

	const nodeOf = (id: Params["id"]): Node => {
		const found = nodes.find((node) => node.id === String(id));

		if (!found) throw new JSONRPCErrorException(`not found: Agent "${id}"`, NOT_FOUND);

		return found;
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
			"project.get": () => ({ models: { roles: [] } }),
			"pad.create": ({ name = "", text = "" }) => {
				if (pads.has(name)) throw new JSONRPCErrorException(`a pad named ${name} exists`, -32602);

				const pad = { name, text, home: null };

				pads.set(name, pad);

				return pad;
			},
			"pad.write": ({ name = "", text = "" }) => {
				const pad = pads.get(name);

				if (!pad) throw new JSONRPCErrorException(`not found: pad ${name}`, NOT_FOUND);

				return Object.assign(pad, { text });
			},
			"pad.move": ({ name = "", home = null }) => {
				const pad = pads.get(name);

				if (!pad) throw new JSONRPCErrorException(`not found: pad ${name}`, NOT_FOUND);

				return Object.assign(pad, { home });
			},
			"pad.read": ({ name = "" }) => {
				const pad = pads.get(name);

				if (!pad) throw new JSONRPCErrorException(`not found: pad ${name}`, NOT_FOUND);

				return pad;
			},
			"agent.spawn": ({ name = "", parent = null }) => {
				const node = { id: String(nextId++), name, kind: "agent", parent, status: { kind: "working", since: Date.now() } };

				nodes.push(node);

				return node;
			},
			"rail.rename": ({ id, name = "" }) => Object.assign(nodeOf(id), { name }),
			"agent.stop": ({ id }) => Object.assign(nodeOf(id), { status: { kind: "done", since: Date.now() } }),
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
		/** The rows started, in order. */
		rows: () => nodes.filter((node) => node.kind === "agent"),
		/** Shows the row `id` waiting on the owner, as roundup does once its question is on screen. */
		waitOnOwner: (id: string) => void Object.assign(nodeOf(id), { status: { kind: "needs-you", since: Date.now() } }),
		/** How many calls of `method` named the Todo `id`. */
		callsOn: (method: string, id: string) => calls.filter((call) => call.method === method && String(call.params.id) === id).length,
		/** Deletes the Pad `name`, as removing the Workstream that holds it does. */
		removePad: (name: string) => void pads.delete(name),
		/** Refuses every call of `method` with `code`. */
		refuse: (method: string, code: number) => void refusals.set(method, code),
		/** Stops answering, as a Daemon that went down. */
		close,
	};
};

export type FakeRoundup = Awaited<ReturnType<typeof fakeRoundup>>;
