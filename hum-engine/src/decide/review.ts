import type { Item } from "../adapter-api.ts";
import type { HumConfig } from "../config/schema.ts";
import { listedPaths } from "./item-lines.ts";
import { DATA_RULE, fenced } from "./prose.ts";

/** What a prompt quotes of an item: plain text, whatever its id's source. */
export type ItemText = { readonly id: string; readonly title: string; readonly body: string };

/** A file a review run reads beside the diff: its path in the repo, and its bytes as the base branch holds them. */
export type ReadFile = { readonly path: string; readonly bytes: Uint8Array };

/** The paths an item's review names, each a file or a folder: the repo's own, then those the item names on a `reads:` line, in order. */
export const reviewPaths = (item: Pick<Item, "body">, { reviewReads }: Pick<HumConfig, "reviewReads">): string[] => [...reviewReads.paths, ...listedPaths(item.body, "reads")];

/** A file's text as far as `room` bytes reach, with no character split. */
const textWithin = (bytes: Uint8Array, room: number): string => new TextDecoder().decode(bytes.subarray(0, room), { stream: true });

type Capped = { readonly shown: readonly { readonly path: string; readonly text: string }[]; readonly cut: readonly string[]; readonly room: number };

/** The files' text in order until `maxBytes` of them are read, and the paths the cap cut short or left out. */
const withinCap = (files: readonly ReadFile[], maxBytes: number): Capped =>
	files.reduce<Capped>(
		({ shown, cut, room }, { path, bytes }) => ({
			shown: room > 0 ? [...shown, { path, text: textWithin(bytes, room) }] : shown,
			cut: bytes.length > room ? [...cut, path] : cut,
			room: Math.max(0, room - bytes.length),
		}),
		{ shown: [], cut: [], room: maxBytes },
	);

/** The part of a review prompt that quotes the files the review reads and names what the byte cap cut; none when no file is named. */
const filesSection = (files: readonly ReadFile[], maxBytes: number): string[] => {
	if (files.length === 0) return [];

	const { shown, cut } = withinCap(files, maxBytes);
	const named = (paths: readonly string[]): string => paths.map((path) => JSON.stringify(path)).join(", ");

	return [
		"## Files to judge the change against",
		"The repo's rules and the files the item names, as the base branch holds them.",
		...shown.map(({ path, text }) => `### ${JSON.stringify(path)}\n${fenced("file", text)}`),
		...(cut.length > 0 ? [`The cap of ${maxBytes} bytes cut ${named(cut)}: what lies past it is not shown.`] : []),
	];
};

/**
 * What a fresh review run reads: the item as the owner asked it, the files the repo and the item name for its review,
 * and the change's diff. It takes no thread, so the author's plan, questions and answers never reach the reviewer.
 */
export const reviewInput = (item: ItemText, diff: string, { diffLimit, reviewReads }: Pick<HumConfig, "diffLimit" | "reviewReads">, files: readonly ReadFile[]): string =>
	[`# Item ${item.id}: ${item.title}`, DATA_RULE, fenced("item", item.body.trim()), ...filesSection(files, reviewReads.maxBytes), `## The change`, fenced("diff", diff.slice(0, diffLimit))].join("\n\n");
