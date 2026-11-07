import { z } from "zod";
import { PermanentError, THREAD_KINDS, type ThreadEntry } from "../adapter-api.ts";

const MARKER = "<!-- hum ";

/** The hidden first line of a comment hum wrote (A16): its kind, the option an answer carries, the options a question offers. */
export const Marker = z.looseObject({
	kind: z.enum(THREAD_KINDS),
	option: z.string().min(1).optional(),
	options: z.array(z.string()).optional(),
	followUp: z.strictObject({ key: z.string(), item: z.string().min(1) }).optional(),
});

export type Marker = z.infer<typeof Marker>;

/** The marker of a question: the options it offers ride in it (A16). */
export const questionMarker = (options?: readonly string[]): Marker => (options?.length ? { kind: "question", options: [...options] } : { kind: "question" });

/** The marker of an answer: the option it carries rides in it (A16). */
export const answerMarker = (option?: string): Marker => (option === undefined ? { kind: "answer" } : { kind: "answer", option });

/** The text of a comment hum writes on a provider's thread. */
export const marked = (marker: Marker, text: string): string => `${MARKER}${JSON.stringify(marker).replaceAll(">", "\\u003e")} -->\n\n${text.trim()}`;

/** The same entry on one line, for a provider whose comments hold one line of at most `limit` characters. Text that does not fit fails: nothing is cut silently. */
export const markedLine = (marker: Marker, text: string, limit: number): string => {
	const line = `${MARKER}${JSON.stringify(marker).replaceAll(">", "\\u003e")} --> ${text.replaceAll(/\s+/g, " ").trim()}`;

	if (line.length > limit) throw new PermanentError(`this provider's comments hold ${limit} characters; this one needs ${line.length}`);

	return line;
};

/** Splits a comment into its leading marker JSON and the text after it, or undefined when it opens with no marker. */
export const splitMarker = (body: string | null, open: string): { json: string; text: string } | undefined => {
	const source = (body ?? "").replaceAll("\r\n", "\n");

	if (!source.startsWith(open)) return undefined;

	const end = source.indexOf(" -->");

	return end < 0 ? undefined : { json: source.slice(open.length, end), text: source.slice(end + " -->".length).trim() };
};

/** The marker on a comment's first line, or undefined for a person's comment. */
export const markerOf = (body: string | null): Marker | undefined => {
	const split = splitMarker(body, MARKER);

	if (!split) return undefined;

	try {
		return Marker.parse(JSON.parse(split.json));
	} catch {
		return undefined; // a person's comment that happens to start this way
	}
};

/** A comment is a thread entry. One without hum's marker, or with no text after it, is a person's and reads as a comment. */
export const parseComment = (body: string | null, at: number): ThreadEntry => {
	const source = (body ?? "").replaceAll("\r\n", "\n");
	const marker = markerOf(source);
	const text = splitMarker(source, MARKER)?.text ?? "";

	if (marker && text !== "") return marker.option === undefined ? { kind: marker.kind, text, at } : { kind: marker.kind, text, at, option: marker.option };

	return { kind: "comment", text: source.trim() === "" ? "(empty)" : source.trim(), at };
};
