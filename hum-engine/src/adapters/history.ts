import { basename } from "node:path";
import parseDiff from "parse-diff";
import PQueue from "p-queue";
import pkg from "../../package.json" with { type: "json" };
import type { HumConfig } from "../config/schema.ts";
import { labelChanges, type PastChange } from "../decide/labels.ts";
import type { Change, Histories, Label } from "../decide/risk.ts";
import { type Git, PATCH } from "./git.ts";

const FIELD = "\u0000";
const RECORD = "\u0001";
const LOG_FORMAT = "--format=%x01%H%x00%s%x00%ct%x00%b%x00";
const NUMSTAT_LINE = /^(\d+|-)\t(\d+|-)\t(.+)$/;
const BLAME_HEADER = /^([0-9a-f]{40}) \d+ \d+/;
const BLAMES_AT_ONCE = 8;
const MANIFEST = "package.json";

/** Each merged change on the first-parent line of `base`, oldest first, with its files and size; `blamed` is left empty. */
const readLog = async (
	git: Git,
	base: string,
	depth: number,
): Promise<PastChange[]> => {
	const out = await git.raw([
		"log",
		"--first-parent",
		"--diff-merges=first-parent",
		"--numstat",
		"--no-renames",
		LOG_FORMAT,
		"-n",
		String(depth),
		base,
	]);

	return out
		.split(RECORD)
		.filter(Boolean)
		.map((record): PastChange => {
			const [sha = "", subject = "", committed = "", body = "", stats = ""] = record.split(FIELD);

			const counted = stats.split("\n").flatMap((line) => {
				const [, added, deleted, file] = NUMSTAT_LINE.exec(line) ?? [];

				return file === undefined
					? []
					: [{ file, lines: (Number(added) || 0) + (Number(deleted) || 0) }];
			});

			return {
				sha,
				subject,
				committedAt: Number(committed) * 1000,
				body: body.trim(),
				files: counted.map(({ file }) => file),
				size: counted.reduce((sum, { lines }) => sum + lines, 0),
				blamed: [],
			};
		})
		.reverse();
};

/** Line ranges, in the parent's numbering, that a change deleted or rewrote, by the file's old path. */
const rewrittenRanges = (
	diff: string,
): readonly { file: string; from: number; to: number }[] =>
	parseDiff(diff).flatMap((file) =>
		file.chunks.flatMap((chunk) => {
			const deleted = chunk.changes.flatMap((change) =>
				change.type === "del" ? [change.ln] : [],
			);

			const first = deleted[0];
			const last = deleted.at(-1);

			return file.from && first !== undefined && last !== undefined
				? [{ file: file.from, from: first, to: last }]
				: [];
		}),
	);

/** The changes that wrote the lines `sha` deleted or rewrote: git blame at its parent. */
const blame = async (git: Git, sha: string): Promise<readonly string[]> => {
	const diff = await git.raw([
		"show",
		...PATCH,
		"--diff-merges=first-parent",
		"-U0",
		"--format=",
		sha,
	]);

	const found = await Promise.all(
		rewrittenRanges(diff).map(async ({ file, from, to }) => {
			const result = await git.run([
				"blame",
				"--porcelain",
				"-L",
				`${from},${to}`,
				`${sha}^`,
				"--",
				file,
			]);

			return result.code === 0
				? result.stdout
						.split("\n")
						.flatMap((line) => BLAME_HEADER.exec(line)?.[1] ?? [])
				: [];
		}),
	);

	return [...new Set(found.flat())];
};

/** The merged changes on `base`, oldest first; each fix commit carries the changes whose lines it changed. */
export const readHistory = async (
	git: Git,
	base: string,
	{
		historyDepth,
		changeLabels,
	}: Pick<HumConfig, "historyDepth" | "changeLabels">,
): Promise<PastChange[]> => {
	const changes = await readLog(git, base, historyDepth);

	const rewrites = (change: PastChange): boolean =>
		[changeLabels.fixSubject, changeLabels.revertSubject].some((subject) => new RegExp(subject).test(change.subject));

	const queue = new PQueue({ concurrency: BLAMES_AT_ONCE });

	return Promise.all(
		changes.map(async (change) =>
			rewrites(change)
				? {
						...change,
						blamed: (await queue.add(() => blame(git, change.sha))) ?? [],
					}
				: change,
		),
	);
};

/** Each path rule's merged changes, newest first: their sizes and labels. */
export const historiesOf = (
	changes: readonly PastChange[],
	{ paths, changeLabels }: Pick<HumConfig, "paths" | "changeLabels">,
	broken: ReadonlySet<string> = new Set(),
): Histories => {
	const labels = labelChanges(changes, changeLabels, broken);
	const newestFirst = changes.toReversed();

	return new Map(
		paths.map(({ glob }) => {
			const onPath = newestFirst.filter((change) =>
				change.files.some((file) => new Bun.Glob(glob).match(file)),
			);

			return [
				glob,
				{
					sizes: onPath.map(({ size }) => size),
					labels: onPath.map(({ sha }): Label => labels.get(sha) ?? "clean"),
				},
			];
		}),
	);
};

const matchesAny = (sources: readonly string[], line: string): boolean =>
	sources.some((source) => new RegExp(source).test(line));

/** What a diff tells the risk level: the paths, the size, a loosened check and a change to the engine's pin. */
export const changeOf = (
	diff: string,
	{ loosenedCheck, lockfiles }: Pick<HumConfig, "loosenedCheck" | "lockfiles">,
): Change => {
	const files = parseDiff(diff);

	const lines = files.flatMap((file) =>
		file.chunks.flatMap((chunk) =>
			chunk.changes.map((change) => ({
				file,
				change,
				text: change.content.slice(1),
			})),
		),
	);

	const holdsPin = (file: parseDiff.File): boolean =>
		[MANIFEST, ...lockfiles].includes(basename(file.to ?? file.from ?? ""));

	return {
		paths: [
			...new Set(
				files.flatMap((file) =>
					[file.from, file.to].filter(
						(path): path is string =>
							path !== undefined && path !== "/dev/null",
					),
				),
			),
		],
		size: files.reduce((sum, file) => sum + file.additions + file.deletions, 0),
		loosened: lines.some(
			({ change, text }) =>
				(change.type === "add" && matchesAny(loosenedCheck.added, text)) ||
				(change.type === "del" && matchesAny(loosenedCheck.removed, text)),
		),
		pinChanged: lines.some(
			({ file, change, text }) =>
				change.type !== "normal" && holdsPin(file) && text.includes(pkg.name),
		),
	};
};
