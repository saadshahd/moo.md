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
	/** The box as Enter took it, while its post is in flight. */
	readonly posted?: string;
};

/** What the box should hold after an event. */
export type BoxWrite = { readonly kind: "keep" } | { readonly kind: "set"; readonly text: string };

export type AnswerContext = {
	readonly answering?: Answering;
	/** Where the owner's Enter went. */
	readonly enter: "claude" | "thread" | "nowhere" | "untouched";
	readonly box: BoxWrite;
	/** One line for the owner: a drop's reason or a toast. */
	readonly say?: string;
};

export type AnswerState = "off" | "on" | "posting";

/** Answer mode as its machine keeps it between events. */
export type AnswerSnapshot = { status: "active"; value: AnswerState; context: AnswerContext; output: undefined; error: undefined };

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
