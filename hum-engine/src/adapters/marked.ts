import { createHash } from "node:crypto";
import { z } from "zod";
import { type Question, THREAD_KINDS, type ThreadEntry } from "../adapter-api.ts";

const OPEN = "<!-- hum ";
const CLOSE = " -->";
const EMPTY_COMMENT = "(empty)";
const FOLLOW_UP_KEY_LENGTH = 12;

/** The hidden first line of a comment hum writes: its kind, the option an answer carries, the options a question offers. */
export const Marker = z.looseObject({
	kind: z.enum(THREAD_KINDS),
	option: z.string().min(1).optional(),
	options: z.array(z.string()).optional(),
	followUp: z.object({ key: z.string(), item: z.string().min(1) }).optional(),
});

export type Marker = z.infer<typeof Marker>;

/**
 * One hidden line that carries `value`: an HTML comment opened by `open`. The value is checked against the schema
 * its reader parses it with, and `>` is written as `>`, so a value can never close the comment that holds it.
 */
export const markerLine = <T>(schema: z.ZodType<T>, value: T, open: string = OPEN): string =>
	`${open}${JSON.stringify(schema.parse(value)).replaceAll(">", "\\u003e")}${CLOSE}`;

/** Whether `line` is one whole hidden line opened by `open`. */
export const isMarkerLine = (line: string, open: string = OPEN): boolean => line.startsWith(open) && line.endsWith(CLOSE);

/** The JSON of a text's leading hidden line and the text after it; undefined when the text opens with no such line. */
export const splitMarker = (body: string, open: string = OPEN): { readonly json: string; readonly text: string } | undefined => {
	const source = body.replaceAll("\r\n", "\n");
	const end = source.indexOf(CLOSE);

	return source.startsWith(open) && end >= 0 ? { json: source.slice(open.length, end), text: source.slice(end + CLOSE.length).trim() } : undefined;
};

/** JSON a person may have written by hand: anything that does not parse, or does not fit `schema`, reads as no value at all. */
export const parseLooseJson = <T>(schema: z.ZodType<T>, json: string): T | undefined => {
	try {
		return schema.safeParse(JSON.parse(json)).data;
	} catch {
		return undefined;
	}
};

export const questionMarker = (options?: readonly string[]): Marker => (options?.length ? { kind: "question", options: [...options] } : { kind: "question" });

export const answerMarker = (option?: string): Marker => (option === undefined ? { kind: "answer" } : { kind: "answer", option });

const FOLD_OPEN = "<details><summary>For Agents</summary>";
const FOLD_CLOSE = "</details>";

/** A question as a thread shows it: the options it offers follow on their own line, and its detail folds below. */
export const questionText = ({ text, options, detail }: Question): string =>
	[text, options?.length ? `Options: ${options.join(", ")}` : undefined, detail?.trim() ? `${FOLD_OPEN}\n\n${detail.trim()}\n\n${FOLD_CLOSE}` : undefined].filter(Boolean).join("\n\n");

const OPTIONS_LINE = /^Options: (.+)$/m;

/** The options a question's thread text offers, from its options line. */
export const optionsIn = (text: string): string[] => (OPTIONS_LINE.exec(text)?.[1] ?? "").split(", ").filter(Boolean);

/** The part of a thread entry's text the owner reads: what comes before the options line and the fold. */
export const visibleText = (text: string): string => text.split(/\n\n(?:Options: |<details>)/)[0] ?? text;

/** A comment's text; a provider that refuses an empty comment gets a placeholder. */
export const commentText = (text: string): string => text.trim() || EMPTY_COMMENT;

/** The same follow-up title from the same item always has the same key, so filing it twice files it once. */
export const followUpKey = (title: string): string => createHash("sha256").update(title).digest("hex").slice(0, FOLLOW_UP_KEY_LENGTH);

const filedFrom = (from: string): string => `Filed from ${from}.`;

/** A follow-up's body, which names the item it came from. */
export const followUpBody = (body: string, from: string): string => `${body.trim()}\n\n${filedFrom(from)}`;

/** Whether an item is the follow-up with this title filed from `from`, read from the item itself: it finds a follow-up whose note on `from` was never written. */
export const isFollowUpOf =
	(from: string, title: string) =>
	(found: { readonly title: string; readonly body: string }): boolean =>
		found.title === title && found.body.trimEnd().endsWith(filedFrom(from));

/** The note left on the item a follow-up came from; its marker carries the key that finds the follow-up again. */
export const followUpNote = (title: string, item: string) => ({
	marker: { kind: "comment", followUp: { key: followUpKey(title), item } } satisfies Marker,
	text: `Filed follow-up #${item}: ${title}`,
});

/** The marker on a comment's first line, or undefined for a person's comment. */
export const markerOf = (body: string): Marker | undefined => {
	const split = splitMarker(body);

	return split && parseLooseJson(Marker, split.json);
};

/** The item a follow-up with this title was filed as, read from the notes on the item it came from. */
export const filedFollowUp = (bodies: readonly string[], title: string): string | undefined =>
	bodies.map(markerOf).find((marker) => marker?.followUp?.key === followUpKey(title))?.followUp?.item;

/** A comment hum writes on a provider's thread. */
export const marked = (marker: Marker, text: string): string => `${markerLine(Marker, marker)}\n\n${text.trim()}`;

/** The same comment on one line, for a provider whose comments hold one line. */
export const markedLine = (marker: Marker, text: string): string => `${markerLine(Marker, marker)} ${text.replaceAll(/\s+/g, " ").trim()}`;

/** The first lines of `text` on one line, cut so the line with its optional marker and the closing `note` fits `limit`. */
export const cutLine = (marker: Marker | undefined, text: string, note: string, limit: number): string => {
	const prefix = marker ? `${markerLine(Marker, marker)} ` : "";
	const room = limit - prefix.length - note.length;
	const head = visibleText(text).replaceAll(/\s+/g, " ").trim();

	return `${prefix}${head.length > room ? `${head.slice(0, room - 1)}…` : head}${note}`;
};

/** A comment as a thread entry. One without hum's marker, or with nothing after it, is a person's and reads as a comment. */
export const parseComment = (body: string, at: number): ThreadEntry => {
	const marker = markerOf(body);
	const text = splitMarker(body)?.text ?? "";

	return marker && text !== "" ? { kind: marker.kind, text, at, option: marker.option, author: "hum" } : { kind: "comment", text: commentText(body.replaceAll("\r\n", "\n")), at, author: "person" };
};
