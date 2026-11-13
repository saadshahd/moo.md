import type { RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { frontmatter } from "micromark-extension-frontmatter";
import { parse, parseDocument, stringify } from "yaml";
import { z } from "zod";
import { PermanentError, THREAD_KINDS, type ThreadEntry } from "../adapter-api.ts";
import { isMarkerLine, markerLine, splitMarker } from "./marked.ts";

/** The front matter `state` of an item hum may take. */
export const READY_STATE = "ready";

/** The front matter `state` of a merged item. */
export const DONE_STATE = "done";

/** Titles are never folded over several lines, so the owner reads the line they wrote. */
const YAML_OPTIONS = { lineWidth: 0 };

const FRONT_MATTER_FENCE = "---";

const FrontMatter = z.looseObject({ title: z.string().min(1), state: z.string().min(1), kind: z.string().min(1).optional() });

const EntryMarker = z.object({ kind: z.enum(THREAD_KINDS), at: z.int().nonnegative(), option: z.string().min(1).optional() });

const Span = z.object({ start: z.object({ offset: z.int() }), end: z.object({ offset: z.int() }) });

/** An item file: YAML front matter, a body, then thread entries, each opened by a hidden `<!-- hum {…} -->` line. */
export type ItemFile = { readonly title: string; readonly state: string; readonly kind: string | undefined; readonly body: string; readonly thread: ThreadEntry[] };

type EntryOpening = { readonly json: string; readonly start: number; readonly end: number };

const parseMarkdown = (source: string) => fromMarkdown(source, { extensions: [frontmatter()], mdastExtensions: [frontmatterFromMarkdown()] });

const spanOf = (node: RootContent) => {
	const { start, end } = Span.parse(node.position);

	return { start: start.offset, end: end.offset };
};

/** The marker JSON of a node that opens a thread entry; a hidden line inside a code block opens none. */
const entryJson = (node: RootContent): string | undefined => (node.type === "html" && isMarkerLine(node.value) ? splitMarker(node.value)?.json : undefined);

const entryOpenings = (nodes: readonly RootContent[]): EntryOpening[] =>
	nodes.flatMap((node) => {
		const json = entryJson(node);

		return json === undefined ? [] : [{ json, ...spanOf(node) }];
	});

const parseEntry = (source: string, opening: EntryOpening, next: EntryOpening | undefined): ThreadEntry => {
	const fields = EntryMarker.parse(JSON.parse(opening.json));
	const text = source.slice(opening.end, next?.start ?? source.length).trim();

	if (text === "") throw new Error(`thread entry at ${fields.at} has no text`);

	return { ...fields, text };
};

export const parseItemFile = (source: string): ItemFile => {
	const nodes = parseMarkdown(source).children;
	const [head] = nodes;

	if (head?.type !== "yaml") throw new Error("front matter missing: the file must open with a '---' block");

	const front = FrontMatter.parse(parse(head.value));
	const openings = entryOpenings(nodes);

	return {
		title: front.title,
		state: front.state,
		kind: front.kind,
		body: source.slice(spanOf(head).end, openings[0]?.start ?? source.length).trim(),
		thread: openings.map((opening, index) => parseEntry(source, opening, openings[index + 1])),
	};
};

const frontMatterBlock = (yaml: string): string => [FRONT_MATTER_FENCE, yaml.trimEnd(), FRONT_MATTER_FENCE].join("\n");

/** A new ready item file. */
export const newItemFile = (title: string, body: string): string => [frontMatterBlock(stringify({ title, state: READY_STATE }, YAML_OPTIONS)), "", body.trim(), ""].join("\n");

/** The file with `state: done` in its front matter, so the merged change itself takes the item off the ready list. */
export const markDone = (source: string): string => {
	const [head] = parseMarkdown(source).children;

	if (head?.type !== "yaml") throw new Error("front matter missing: the file must open with a '---' block");

	const { start, end } = spanOf(head);
	const front = parseDocument(head.value);

	FrontMatter.parse(front.toJS());
	front.set("state", DONE_STATE);

	return [source.slice(0, start), frontMatterBlock(front.toString(YAML_OPTIONS)), source.slice(end)].join("");
};

/** The file with one more thread entry. Text that would open an entry of its own is refused. */
export const appendEntry = (source: string, entry: Omit<ThreadEntry, "text">, text: string): string => {
	if (entryOpenings(parseMarkdown(text).children).length > 0) throw new PermanentError("an entry's text may not hold a line hum reads as the start of an entry");

	return [source.trimEnd(), "", markerLine(EntryMarker, entry), text.trim(), ""].join("\n");
};
