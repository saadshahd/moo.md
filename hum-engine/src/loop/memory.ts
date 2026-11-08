import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import type { Finished } from "../adapters/claude-p.ts";

export type MemoryEntry = { readonly rule: string; readonly source: string };

/** One entry per line: `- <rule> (source: <where the owner said it>)`. */
const ENTRY_LINE = /^- (.+) \(source: (.+)\)$/;

export class MemoryFormatError extends Error {
	override name = "MemoryFormatError";
}

export class MemoryFull extends Error {
	override name = "MemoryFull";
}

const squash = (rule: string): string => rule.toLowerCase().replace(/\s+/g, " ").trim();

/** The entries of a memory file. A list line with no source is refused: every entry names where it came from. */
export const parseMemory = (text: string): MemoryEntry[] =>
	text.split("\n").flatMap((line, at): MemoryEntry[] => {
		if (!line.startsWith("- ")) return [];

		const [, rule, source] = ENTRY_LINE.exec(line) ?? [];

		if (rule === undefined || source === undefined) throw new MemoryFormatError(`memory.md line ${at + 1} has no "(source: …)": ${line.slice(0, 80)}`);

		return [{ rule, source }];
	});

export const renderMemory = (entries: readonly MemoryEntry[]): string => entries.map(({ rule, source }) => `- ${rule} (source: ${source})\n`).join("");

/** A new entry on a rule already held replaces it, so one rule has one entry; past the byte cap the entry is refused. */
export const addEntry = (entries: readonly MemoryEntry[], entry: MemoryEntry, maxBytes: number): MemoryEntry[] => {
	const next = [...entries.filter(({ rule }) => squash(rule) !== squash(entry.rule)), entry];

	if (Buffer.byteLength(renderMemory(next)) > maxBytes) throw new MemoryFull(`memory.md would pass ${maxBytes} bytes; remove an entry first`);

	return next;
};

/** The entries left once a check covers the rules whose sources are `covered`. */
export const withoutCovered = (entries: readonly MemoryEntry[], covered: ReadonlySet<string>): MemoryEntry[] => entries.filter(({ source }) => !covered.has(source));

/** Entries no run used within the last `limit` runs: `lastUsed` is the run number of an entry's last use, absent when none used it. */
export const unusedEntries = (entries: readonly MemoryEntry[], lastUsed: ReadonlyMap<string, number>, runsSoFar: number, limit: number): MemoryEntry[] =>
	entries.filter(({ rule }) => runsSoFar - (lastUsed.get(rule) ?? 0) >= limit);

/** The entries of the file at `path`; none when it is absent. */
export const readMemory = (path: string): MemoryEntry[] => (existsSync(path) ? parseMemory(readFileSync(path, "utf8")) : []);

/** What a run reads of memory.md: its rules, numbered, and the ask to name the ones it applied. */
export const memorySection = (entries: readonly MemoryEntry[]): string =>
	entries.length === 0 ? "" : `\n\n## Standing rules\n${entries.map(({ rule }, at) => `${at + 1}. ${rule}`).join("\n")}\nIn "memoryUsed", give the number of each rule you applied.`;

const Applied = z.object({ memoryUsed: z.array(z.int().positive()) });

/** The rules a run says it applied, from the numbers in its answer; numbers beyond the list name nothing. */
export const rulesUsed = ({ structured }: Pick<Finished, "structured">, entries: readonly MemoryEntry[]): string[] =>
	(Applied.safeParse(structured).data?.memoryUsed ?? []).flatMap((number) => entries[number - 1]?.rule ?? []);

export type MemoryUse = { readonly runsSoFar: number; readonly lastUsed: ReadonlyMap<string, number> };

/** From the runs that were shown memory.md, oldest first: how many there were, and the run each rule was last used in. */
export const useOf = (runs: readonly { readonly memoryUsed?: readonly string[] }[]): MemoryUse => {
	const shown = runs.flatMap(({ memoryUsed }) => (memoryUsed === undefined ? [] : [memoryUsed]));

	return { runsSoFar: shown.length, lastUsed: new Map(shown.flatMap((rules, at) => rules.map((rule): [string, number] => [rule, at + 1]))) };
};
