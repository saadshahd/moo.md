import type { Item } from "../adapter-api.ts";
import { declaredKind } from "../decide/kind.ts";
import { usualSize } from "../decide/risk.ts";
import type { HumConfig, PathRule, RunPlace, SlotRecipe } from "../config/schema.ts";
import type { CiJob, RepoScan } from "./scan.ts";
import {
	CHECK_COMMAND,
	CHECK_SCRIPTS,
	DATA_AND_SECRET_GLOBS,
	DEFAULT_FOLDER_RANK,
	FOLDER_RANKS,
	INSTALL_COMMANDS,
	KIND_LABEL_WORDS,
	NOT_A_CHECK,
	ROOT_MARKDOWN_RANK,
	RUN_SCRIPT,
	SECRET_TEMPLATE,
} from "./tables.ts";

/** The settings setup proposes from a scan; the owner changes any of them before they are written. */
export type Proposal = {
	readonly checks: readonly string[];
	readonly paths: readonly PathRule[];
	readonly strictPaths: readonly string[];
	/** The top of each folder's usual size; undefined while it has too few merged changes to have one. */
	readonly usualSizes: readonly { readonly folder: string; readonly usual: number | undefined }[];
	readonly windows: Pick<HumConfig["changeLabels"], "fixWindow"> & Pick<HumConfig, "measureWindow">;
	readonly kindLabels: Readonly<Record<string, string>>;
	readonly runSlots: Pick<HumConfig["runSlots"], "services" | "recipe">;
	readonly runPlaces: readonly RunPlace[];
};

const isPullRequestJob = ({ triggers }: CiJob): boolean => triggers.includes("pull_request");

const isCheck = (command: string): boolean => CHECK_COMMAND.test(command) && !NOT_A_CHECK.test(command);

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const scriptCommand = (scan: RepoScan, script: string): string | undefined => {
	const run = scan.packageManager === undefined ? undefined : RUN_SCRIPT[scan.packageManager];

	return run !== undefined && script in scan.scripts ? `${run} ${script}` : undefined;
};

/**
 * The commands the repo's own CI runs on a pull request to check a change; else its package scripts that check.
 * A run checks a fresh clone, which has no dependencies yet, so the lockfile install comes first.
 */
export const checksOf = (scan: RepoScan): string[] => {
	const fromCi = unique(scan.ci.filter(isPullRequestJob).flatMap(({ commands }) => commands.filter(isCheck)));
	const checks = fromCi.length > 0 ? fromCi : CHECK_SCRIPTS.flatMap((script) => scriptCommand(scan, script) ?? []);

	return scan.packageManager === undefined || checks.length === 0 ? checks : [INSTALL_COMMANDS[scan.packageManager], ...checks];
};

const levelAt = (levels: HumConfig["levels"], rank: number): string => levels[Math.min(rank, levels.length - 1)]?.name ?? "";

const rankOfFolder = (folder: string): number => FOLDER_RANKS.find((row) => row.folder.test(folder))?.rank ?? DEFAULT_FOLDER_RANK;

const topFolders = (tracked: readonly string[]): string[] => unique(tracked.flatMap((path) => (path.includes("/") ? [path.split("/")[0] ?? ""] : []))).sort();

/** A rule per top-level folder, one for markdown at the root and one for the other root files, so no path is left unplaced. */
export const pathRulesOf = (tracked: readonly string[], levels: HumConfig["levels"]): PathRule[] => [
	...topFolders(tracked).map((folder) => ({ glob: `${folder}/**`, level: levelAt(levels, rankOfFolder(folder)) })),
	{ glob: "*.md", level: levelAt(levels, ROOT_MARKDOWN_RANK) },
	{ glob: "*", level: levelAt(levels, DEFAULT_FOLDER_RANK) },
];

/** The data and secrets globs that match a tracked file; a file that only shows the shape of a secret does not count. */
export const strictGlobsOf = (tracked: readonly string[]): string[] =>
	DATA_AND_SECRET_GLOBS.filter((glob) => tracked.some((path) => new Bun.Glob(glob).match(path) && !SECRET_TEMPLATE.test(path)));

const mapLabels = (labels: readonly string[], kinds: readonly string[]): Record<string, string> =>
	Object.fromEntries(
		unique(labels.map((label) => label.toLowerCase())).flatMap((label) => {
			const kind = Object.entries(KIND_LABEL_WORDS).find(([name, words]) => kinds.includes(name) && new Set<string>(words).has(label))?.[0];

			return kind === undefined || kinds.includes(label) ? [] : [[label, kind]];
		}),
	);

/** Label → kind for the labels the repo uses: those on its issue templates and the ones it lists. A label the table does not know is left out. */
export const kindLabelsOf = (scan: RepoScan, repoLabels: readonly string[], kinds: readonly string[]): Record<string, string> =>
	mapLabels([...scan.issueTemplates.flatMap(({ labels }) => labels), ...repoLabels], kinds);

/** How many of the open items name their kind through the map, a kind's own name or a template field. */
export const kindCoverage = (items: readonly Pick<Item, "body" | "labels">[], kinds: readonly string[], kindLabels: HumConfig["kindLabels"]) => ({
	covered: items.filter((item) => declaredKind(item, kinds, kindLabels) !== undefined).length,
	total: items.length,
});

const recipeOf = (scan: RepoScan, checks: readonly string[]): SlotRecipe => {
	const install = scan.packageManager === undefined ? [] : [INSTALL_COMMANDS[scan.packageManager]];
	const [script] = scan.envScripts;
	const seed = scriptCommand(scan, "seed");
	const services = scan.composeServices.length > 0 ? ['docker compose -p "$COMPOSE_PROJECT_NAME" up -d --wait'] : [];
	const [fast] = checks.filter((command) => /\b(lint|typecheck|check)\b/.test(command));

	return {
		prepare: script === undefined ? [...install, ...services, ...(seed ? [seed] : [])] : [`./${script}`],
		refresh: script === undefined ? install.map((run) => ({ run, when: "lockfile-changed" as const })) : [{ run: `./${script}`, when: "lockfile-changed" as const }],
		ready: [fast ?? checks[0]].flatMap((command) => command ?? []),
	};
};

/** Everything setup proposes from a scan, before it asks. */
export const proposeSetup = (scan: RepoScan, shipped: HumConfig, repoLabels: readonly string[] = []): Proposal => {
	const checks = checksOf(scan);

	return {
		checks,
		paths: pathRulesOf(scan.tracked, shipped.levels),
		strictPaths: strictGlobsOf(scan.tracked),
		usualSizes: scan.folders.map(({ folder, sizes }) => ({ folder, usual: usualSize(sizes, shipped.sizeRange) })),
		windows: { fixWindow: shipped.changeLabels.fixWindow, measureWindow: shipped.measureWindow },
		kindLabels: kindLabelsOf(scan, repoLabels, shipped.kinds),
		runSlots: { services: shipped.runSlots.services, recipe: recipeOf(scan, checks) },
		runPlaces: shipped.runPlaces,
	};
};
