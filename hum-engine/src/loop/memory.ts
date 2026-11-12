import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import type { Finished } from "../adapters/claude-p.ts";
import type { RunRecord } from "../state/runs.ts";

export type MemoryEntry = { readonly rule: string; readonly source: string };

/** One entry per line: `- <rule> (source: <where the owner said it>)`. */
const ENTRY_LINE = /^- (.+) \(source: (.+)\)$/;

/** A memory.md list line runs are not shown: it names no source, or it comes after the entries passed the byte cap. */
export type RefusedLine = { readonly line: number; readonly why: "no-source" | "past-cap" };

/** What memory.md holds: the entries runs are shown, and the list lines refused. */
export type Memory = { readonly entries: readonly MemoryEntry[]; readonly refused: readonly RefusedLine[] };

const NO_MEMORY: Memory = { entries: [], refused: [] };

const entryOf = (line: string): MemoryEntry | undefined => {
	const [, rule, source] = ENTRY_LINE.exec(line) ?? [];

	return rule === undefined || source === undefined ? undefined : { rule, source };
};

const isListLine = (line: string): boolean => line.startsWith("- ");

/** The entries of a memory file, in order, while their lines fit in `maxBytes`; every entry names where it came from. */
export const parseMemory = (text: string, maxBytes: number): Memory => {
	const { entries, refused } = text.split("\n").reduce(
		(memory, line, at) => {
			if (!isListLine(line)) return memory;

			const entry = entryOf(line);
			const bytes = memory.bytes + Buffer.byteLength(`${line}\n`);
			const refuse = (why: RefusedLine["why"]) => ({ ...memory, refused: [...memory.refused, { line: at + 1, why }] });

			if (entry === undefined) return refuse("no-source");

			return bytes > maxBytes ? { ...refuse("past-cap"), bytes } : { ...memory, bytes, entries: [...memory.entries, entry] };
		},
		{ ...NO_MEMORY, bytes: 0 },
	);

	return { entries, refused };
};

/** memory.md's text without the entries whose sources a check now covers; every other line stays as the owner wrote it. */
export const withoutCovered = (text: string, covered: ReadonlySet<string>): string =>
	text
		.split("\n")
		.filter((line) => {
			const source = entryOf(line)?.source;

			return source === undefined || !covered.has(source);
		})
		.join("\n");

/** Entries no run used within the last `limit` runs: `lastUsed` is the run number of an entry's last use, absent when none used it. */
export const unusedEntries = ({ entries, lastUsed, runsSoFar, limit }: { readonly entries: readonly MemoryEntry[]; readonly lastUsed: ReadonlyMap<string, number>; readonly runsSoFar: number; readonly limit: number }): MemoryEntry[] =>
	entries.filter(({ rule }) => runsSoFar - (lastUsed.get(rule) ?? 0) >= limit);

/** The memory file at `path`; empty when it is absent. */
export const readMemory = (path: string, maxBytes: number): Memory => (existsSync(path) ? parseMemory(readFileSync(path, "utf8"), maxBytes) : NO_MEMORY);

/** What a run reads of memory.md: its rules, numbered, and the ask to name the ones it applied. */
export const memorySection = (entries: readonly MemoryEntry[]): string =>
	entries.length === 0 ? "" : `\n\n## Standing rules\n${entries.map(({ rule }, at) => `${at + 1}. ${rule}`).join("\n")}\nIn "memoryUsed", give the number of each rule you applied.`;

const Applied = z.object({ memoryUsed: z.array(z.int().positive()) });

/** The rules a run says it applied, from the numbers in its answer; numbers beyond the list name nothing. */
export const rulesUsed = ({ structured }: Pick<Finished, "structured">, entries: readonly MemoryEntry[]): string[] =>
	(Applied.safeParse(structured).data?.memoryUsed ?? []).flatMap((number) => entries[number - 1]?.rule ?? []);

export type MemoryUse = { readonly runsSoFar: number; readonly lastUsed: ReadonlyMap<string, number> };

/** From the runs that were shown memory.md, oldest first: how many there were, and the run each rule was last used in. */
export const useOf = (runs: readonly RunRecord[]): MemoryUse => {
	const shown = runs.flatMap((run) => (run.endedAt === undefined || run.memoryUsed === undefined ? [] : [run.memoryUsed]));

	return { runsSoFar: shown.length, lastUsed: new Map(shown.flatMap((rules, at) => rules.map((rule): [string, number] => [rule, at + 1]))) };
};
