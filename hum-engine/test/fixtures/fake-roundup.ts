import { z } from "zod";
import type { ToolCall } from "../../src/index.ts";

const Args = z.looseObject({ id: z.int().optional(), title: z.string().optional(), body: z.string().optional(), name: z.string().optional(), text: z.string().optional() });

/** What roundup holds an Agent's comment to. */
const COMMENT_LIMIT = 280;

type Todo = { id: number; title: string; body: string; done: boolean; blocked: boolean; owner: { kind: string; id: string } | null; updated_at: number };

type Comment = { id: number; body: string; created_at: number };

/** An in-memory roundup MCP server for one Project: Todos and their comments, with comment ids that follow the order of writes. */
export class FakeRoundup {
	#todos: Todo[] = [];
	#comments = new Map<number, Comment[]>();
	#next = 1;
	#clock = 0;
	readonly calls: string[] = [];
	/** Tools whose next call throws. */
	readonly failsOnce = new Set<string>();
	/** Pads by name. */
	readonly pads = new Map<string, string>();

	seed(title: string, patch: Partial<Todo> = {}): number {
		const todo: Todo = { id: this.#todos.length + 1, title, body: `${title} body`, done: false, blocked: false, owner: null, updated_at: ++this.#clock, ...patch };

		this.#todos.push(todo);

		return todo.id;
	}

	/** A person's comment. */
	say(id: number, body: string): void {
		this.#comment(id, body);
	}

	#comment(id: number, body: string): Comment {
		const made = { id: this.#next++, body, created_at: ++this.#clock };
		this.#comments.set(id, [...(this.#comments.get(id) ?? []), made]);

		return made;
	}

	#todo(id: number | undefined): Todo {
		const found = this.#todos.find((todo) => todo.id === id);

		if (!found) throw new Error(`no Todo ${id}`);

		return found;
	}

	call: ToolCall = async (tool, raw) => {
		const args = Args.parse(raw);

		this.calls.push(tool);

		if (this.failsOnce.delete(tool)) throw new Error(`${tool} failed`);

		switch (tool) {
			case "todo_list":
				return structuredClone(this.#todos);
			case "todo_get":
				return structuredClone(this.#todo(args.id));
			case "todo_comments":
				return structuredClone(this.#comments.get(this.#todo(args.id).id) ?? []);
			case "todo_comment": {
				const body = args.body ?? "";

				if (body.includes("\n") || body.length > COMMENT_LIMIT) throw new Error("an Agent's comment is one line of at most 280 characters");

				return this.#comment(this.#todo(args.id).id, body);
			}

			case "pad_create":
				this.pads.set(String(args.name), args.text ?? "");

				return { name: String(args.name) };
			case "todo_complete":
				this.#todo(args.id).done = true;

				return structuredClone(this.#todo(args.id));
			case "todo_create": {
				const id = this.seed(String(args.title), { body: String(args.body ?? "") });

				return structuredClone(this.#todo(id));
			}

			default:
				throw new Error(`the fake has no tool ${tool}`);
		}
	};
}
