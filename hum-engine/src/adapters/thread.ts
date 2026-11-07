import { z } from "zod";
import { PermanentError, THREAD_KINDS, type ThreadEntry } from "../adapter-api.ts";

/** Each thread entry opens with a `<!-- hum {json} -->` line and runs to the next one. */
export const THREAD_MARKER = "<!-- hum ";

const Marker = z.strictObject({ kind: z.enum(THREAD_KINDS), at: z.int().nonnegative(), option: z.string().min(1).optional() });

/** Splits lines into the text before the first entry and the entries after it. */
export const parseThread = (lines: readonly string[]) => {
	const body: string[] = [];
	const thread: ThreadEntry[] = [];
	let open: { marker: z.infer<typeof Marker>; lines: string[] } | undefined;

	const closeEntry = () => {
		if (!open) return;

		const text = open.lines.join("\n").trim();

		if (text === "") throw new Error(`thread entry at ${open.marker.at} has no text`);

		thread.push({ ...open.marker, text });
		open = undefined;
	};

	for (const line of lines) {
		if (line.startsWith(THREAD_MARKER) && line.endsWith(" -->")) {
			closeEntry();
			open = { marker: Marker.parse(JSON.parse(line.slice(THREAD_MARKER.length, -" -->".length))), lines: [] };
		} else if (open) open.lines.push(line);
		else body.push(line);
	}

	closeEntry();

	const text = body.join("\n").trim();

	return { body: text, thread };
};

export const appendEntry = (source: string, entry: Omit<ThreadEntry, "text">, text: string): string => {
	if (text.split("\n").some((line) => line.startsWith(THREAD_MARKER))) throw new PermanentError(`text may not hold a line starting with "${THREAD_MARKER}"`);

	const marker = JSON.stringify(entry).replaceAll(">", "\\u003e");

	return `${source.endsWith("\n") ? source : `${source}\n`}\n${THREAD_MARKER}${marker} -->\n${text.trim()}\n`;
};
