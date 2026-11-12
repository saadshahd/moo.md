/** What the poller last found at the status file's path. */
export type ViewSource =
	| { kind: "waiting" }
	| { kind: "missing"; path: string }
	| { kind: "text"; text: string }
	| { kind: "failed"; message: string };

/** The answer a fill started: the item, the words in front of the owner's own, and the option it carries. */
export type Answering = {
	readonly item: string;
	/** How the item reads to the owner, `#68` or a slug. */
	readonly label: string;
	/** `#68: `: while the box starts with it, Enter posts on the thread. */
	readonly opener: string;
	/** What the fill put in the box. */
	readonly filled: string;
	/** An open sentence waits for the owner's words; a whole answer is complete as filled. */
	readonly isOpen: boolean;
	readonly option?: string;
};

/** An answer whose post is in flight, with the box as Enter took it. */
export type Posting = Answering & { readonly posted: string };

/** What the box should hold after an event. */
export type BoxWrite = { readonly kind: "keep" } | { readonly kind: "set"; readonly text: string };

/** What one event decided, in every state. */
export type AnswerOutcome = {
	/** Where the owner's Enter went. */
	readonly enter: "claude" | "thread" | "nowhere" | "untouched";
	readonly box: BoxWrite;
	/** One line for the owner: a drop's reason or a toast. */
	readonly say?: string;
};

/** One state of answer mode, as its machine keeps it. */
export type AnswerSnapshotIn<State extends string, Context> = { status: "active"; value: State; context: AnswerOutcome & Context; output: undefined; error: undefined };

/** Answer mode as its machine keeps it between events: off holds no answer, on holds the answer the box is filling, posting holds the answer in flight. */
export type AnswerSnapshot =
	| AnswerSnapshotIn<"off", { readonly answering?: undefined }>
	| AnswerSnapshotIn<"on", { readonly answering: Answering }>
	| AnswerSnapshotIn<"posting", { readonly answering: Posting }>;

export type AnswerState = AnswerSnapshot["value"];

/** A read of what changed that keeps failing: its cause and when the failures began. */
export type Unread = { readonly cause: string; readonly since: number };

declare module "claude-code" {
	interface PluginState {
		hum: {
			source: Shaped<ViewSource>;
			unfolded: Shaped<string[]>;
			answerMode: Shaped<AnswerSnapshot>;
			unread: Shaped<Unread | null>;
		};
	}
}
