import { accessSync, constants, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { gitIn } from "../adapters/git.ts";
import { readHistory } from "../adapters/history.ts";
import { SHIPPED_DEFAULTS } from "../config/schema.ts";
import { orMissing } from "../state/fs.ts";
import { ENV_SCRIPTS } from "../slots/scan.ts";
import {
	CODEOWNERS_FILES,
	COMPOSE_FILES,
	ENV_EXAMPLE_FILES,
	ENV_TOOLING_FILES,
	ISSUE_TEMPLATE_FOLDER,
	LOCKFILES,
	type PackageManager,
	SETUP_TARGETS,
	TOOL_VERSION_FILES,
	TRACKED_FILE_LIMIT,
	WORKFLOW_FOLDER,
} from "./tables.ts";

/** One job of a CI workflow: when it runs and the shell commands its steps run. */
export type CiJob = { readonly file: string; readonly job: string; readonly triggers: readonly string[]; readonly commands: readonly string[] };

export type FolderHistory = { readonly folder: string; readonly changes: number; readonly sizes: readonly number[] };

/** What a repo already holds that setup reads before it asks. */
export type RepoScan = {
	readonly packageManager: PackageManager | undefined;
	readonly scripts: Readonly<Record<string, string>>;
	readonly ci: readonly CiJob[];
	readonly codeowners: readonly { readonly glob: string; readonly owners: readonly string[] }[];
	readonly composeServices: readonly { readonly name: string; readonly image: string | undefined }[];
	readonly envScripts: readonly string[];
	readonly setupTargets: readonly string[];
	readonly toolVersions: readonly string[];
	readonly envExamples: readonly string[];
	readonly envTooling: readonly string[];
	readonly issueTemplates: readonly { readonly file: string; readonly labels: readonly string[] }[];
	readonly tracked: readonly string[];
	readonly folders: readonly FolderHistory[];
	/** The engine version `package.json` pins, and the schema version `.hum/hum.json` has. */
	readonly engine: { readonly pinned: string | undefined };
	readonly hum: { readonly schemaVersion: number | undefined };
};

const textOf = (repo: string, path: string): string => (path === "" ? "" : orMissing(() => readFileSync(join(repo, path), "utf8"), ""));

const exists = (repo: string, path: string): boolean => orMissing(() => (accessSync(join(repo, path)), true), false);

const isRunnable = (repo: string, path: string): boolean => orMissing(() => (accessSync(join(repo, path), constants.X_OK), true), false);

const filesIn = (repo: string, pattern: string): string[] => [...new Bun.Glob(pattern).scanSync({ cwd: repo, onlyFiles: true, dot: true })].sort();

const PackageJson = z.looseObject({
	scripts: z.record(z.string(), z.string()).default({}),
	dependencies: z.record(z.string(), z.string()).default({}),
	devDependencies: z.record(z.string(), z.string()).default({}),
});

const Workflow = z.looseObject({
	on: z.union([z.string().transform((trigger) => [trigger]), z.array(z.string()), z.record(z.string(), z.unknown()).transform((triggers) => Object.keys(triggers))]).default([]),
	jobs: z.record(z.string(), z.looseObject({ steps: z.array(z.looseObject({ run: z.string().optional() })).default([]) })).default({}),
});

const Compose = z.looseObject({ services: z.record(z.string(), z.looseObject({ image: z.string().optional() })).default({}) });

const Template = z.looseObject({ labels: z.union([z.string(), z.array(z.string())]).default([]) });

const TEMPLATE_FRONT_MATTER = /^---\n([\s\S]*?)\n---/;

const commandsOf = (run: string): string[] =>
	run
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "" && !line.startsWith("#"));

/** The CI workflows' jobs. A workflow that does not parse is skipped, because the owner's CI is not setup's to judge. */
const ciJobsOf = (repo: string): CiJob[] =>
	filesIn(repo, `${WORKFLOW_FOLDER}/*.{yml,yaml}`).flatMap((file) => {
		const parsed = Workflow.safeParse(parseYaml(textOf(repo, file)));

		if (!parsed.success) return [];

		const triggers = parsed.data.on;

		return Object.entries(parsed.data.jobs).map(([job, { steps }]) => ({
			file: basename(file),
			job,
			triggers,
			commands: steps.flatMap((step) => commandsOf(step.run ?? "")),
		}));
	});

const codeownersOf = (repo: string): RepoScan["codeowners"] => {
	const file = CODEOWNERS_FILES.find((candidate) => exists(repo, candidate));

	return textOf(repo, file ?? "")
		.split("\n")
		.map((line) => line.replace(/#.*/, "").trim().split(/\s+/))
		.flatMap(([glob, ...owners]) => (glob === undefined || glob === "" || owners.length === 0 ? [] : [{ glob, owners }]));
};

const composeOf = (repo: string): RepoScan["composeServices"] => {
	const file = COMPOSE_FILES.find((candidate) => exists(repo, candidate));
	const parsed = Compose.safeParse(parseYaml(textOf(repo, file ?? "")));

	return parsed.success ? Object.entries(parsed.data.services).map(([name, { image }]) => ({ name, image })) : [];
};

/** The environment scripts a repo is built to run: executable files in the usual places. */
const envScriptsOf = (repo: string): string[] => ENV_SCRIPTS.filter((script) => isRunnable(repo, script));

/** Makefile and justfile targets, and package scripts, that set up or seed an environment. */
const setupTargetsOf = (repo: string, scripts: Readonly<Record<string, string>>): string[] => {
	const targets = ["Makefile", "justfile"].flatMap((file) => [...textOf(repo, file).matchAll(/^([\w:.-]+):/gm)].map(([, target]) => target ?? ""));

	const wanted = new Set<string>(SETUP_TARGETS);

	return [...new Set([...Object.keys(scripts), ...targets])].filter((target) => wanted.has(target));
};

const templatesOf = (repo: string): RepoScan["issueTemplates"] =>
	filesIn(repo, `${ISSUE_TEMPLATE_FOLDER}/*`).flatMap((file) => {
		const text = textOf(repo, file);
		const front = file.endsWith(".md") ? TEMPLATE_FRONT_MATTER.exec(text)?.[1] ?? "" : text;
		const parsed = Template.safeParse(parseYaml(front));

		return parsed.success ? [{ file: basename(file), labels: [parsed.data.labels].flat().flatMap((label) => label.split(",").map((one) => one.trim()).filter(Boolean)) }] : [];
	});

const trackedOf = async (repo: string): Promise<string[]> => (await gitIn(repo).raw(["ls-files"])).split("\n").filter(Boolean).slice(0, TRACKED_FILE_LIMIT);

const topFolder = (path: string): string => (path.includes("/") ? (path.split("/")[0] ?? path) : "");

/** Each top-level folder's merged changes on the base, from the history setup reads. */
const foldersOf = async (repo: string, base: string): Promise<FolderHistory[]> => {
	const git = gitIn(repo);
	const log = await git.run(["rev-parse", "--verify", "-q", base]);

	if (log.code !== 0) return [];

	const changes = await readHistory(git, base, SHIPPED_DEFAULTS);
	const folders = new Map<string, number[]>();

	for (const change of changes) {
		for (const folder of new Set(change.files.map(topFolder).filter(Boolean))) folders.set(folder, [...(folders.get(folder) ?? []), change.size]);
	}

	return [...folders].map(([folder, sizes]) => ({ folder, changes: sizes.length, sizes: sizes.toReversed() }));
};

const humSchemaOf = (repo: string): number | undefined => {
	const parsed = z.looseObject({ schemaVersion: z.number().optional() }).safeParse(orMissing(() => JSON.parse(textOf(repo, ".hum/hum.json") || "null"), null));

	return parsed.success ? parsed.data.schemaVersion : undefined;
};

/** Reads the repo's package manager, CI, scripts, owners, services, environment tooling, issue templates and per-folder history. */
export const scanRepo = async (repo: string, base: string): Promise<RepoScan> => {
	const manifest = PackageJson.safeParse(orMissing(() => JSON.parse(textOf(repo, "package.json") || "null"), null));
	const scripts = manifest.success ? manifest.data.scripts : {};
	const pinned = manifest.success ? { ...manifest.data.dependencies, ...manifest.data.devDependencies }["@moo.md/hum"] : undefined;
	const lockfile = Object.entries(LOCKFILES).find(([file]) => exists(repo, file));

	return {
		packageManager: lockfile?.[1],
		scripts,
		ci: ciJobsOf(repo),
		codeowners: codeownersOf(repo),
		composeServices: composeOf(repo),
		envScripts: envScriptsOf(repo),
		setupTargets: setupTargetsOf(repo, scripts),
		toolVersions: TOOL_VERSION_FILES.filter((file) => exists(repo, file)),
		envExamples: ENV_EXAMPLE_FILES.filter((file) => exists(repo, file)),
		envTooling: ENV_TOOLING_FILES.filter((file) => exists(repo, file)),
		issueTemplates: templatesOf(repo),
		tracked: await trackedOf(repo),
		folders: await foldersOf(repo, base),
		engine: { pinned },
		hum: { schemaVersion: humSchemaOf(repo) },
	};
};
