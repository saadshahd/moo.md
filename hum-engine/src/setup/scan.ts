import { accessSync, constants, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseDocument } from "yaml";
import { z } from "zod";
import { gitIn } from "../adapters/git.ts";
import { readHistory } from "../adapters/history.ts";
import { SHIPPED_DEFAULTS } from "../config/schema.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { orMissing } from "../state/fs.ts";
import {
	CODEOWNERS_FILES,
	COMPOSE_FILES,
	ENV_EXAMPLE_FILES,
	ENV_SCRIPTS,
	ENV_TOOLING_FILES,
	ISSUE_TEMPLATE_FOLDER,
	LOCKFILES,
	type PackageManager,
	SETUP_TARGETS,
	TOOL_VERSION_FILES,
	TRACKED_FILE_LIMIT,
	WORKFLOW_FOLDER,
} from "./tables.ts";

/** One job of a CI workflow: when it runs, where, with what env, and the shell commands and actions its steps run. */
export type CiJob = {
	readonly file: string;
	readonly job: string;
	readonly triggers: readonly string[];
	readonly commands: readonly string[];
	/** The runner, when the job names one label. */
	readonly runner: string | undefined;
	/** The image of the job's container. */
	readonly container: string | undefined;
	/** The env every step gets: the workflow's, with the job's own over it. */
	readonly env: Readonly<Record<string, string>>;
	readonly actions: readonly { readonly uses: string; readonly with: Readonly<Record<string, string>> }[];
};

type FolderHistory = { readonly folder: string; readonly changes: number; readonly sizes: readonly number[] };

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

const doesExist = (repo: string, path: string): boolean => orMissing(() => (accessSync(join(repo, path)), true), false);

const isRunnable = (repo: string, path: string): boolean => orMissing(() => (accessSync(join(repo, path), constants.X_OK), true), false);

const filesIn = (repo: string, pattern: string): string[] => [...new Bun.Glob(pattern).scanSync({ cwd: repo, onlyFiles: true, dot: true })].sort();

const PackageJson = z.looseObject({
	scripts: z.record(z.string(), z.string()).default({}),
	dependencies: z.record(z.string(), z.string()).default({}),
	devDependencies: z.record(z.string(), z.string()).default({}),
});

/** YAML reads `1` and `true` as a number and a boolean; a workflow passes each on as text. */
const Text = z.union([z.string(), z.number(), z.boolean()]).transform(String);

/** A map of text, or none where the workflow writes an expression in its place. */
const TextMap = z.record(z.string(), Text).catch({});

const Container = z.union([z.string(), z.looseObject({ image: z.string() }).transform(({ image }) => image)]).optional().catch(undefined);

const Workflow = z.looseObject({
	on: z.union([z.string().transform((trigger) => [trigger]), z.array(z.string()), z.record(z.string(), z.unknown()).transform((triggers) => Object.keys(triggers))]).default([]),
	env: TextMap,
	jobs: z
		.record(
			z.string(),
			z.looseObject({
				"runs-on": z.string().optional().catch(undefined),
				container: Container,
				env: TextMap,
				steps: z.array(z.looseObject({ run: z.string().optional(), uses: z.string().optional(), with: TextMap })).default([]),
			}),
		)
		.default({}),
});

const Compose = z.looseObject({ services: z.record(z.string(), z.looseObject({ image: z.string().optional() })).default({}) });

const Template = z.looseObject({ labels: z.union([z.string(), z.array(z.string())]).default([]) });

const TEMPLATE_FRONT_MATTER = /^---\n([\s\S]*?)\n---/;

/** A YAML file read through `schema`, or undefined when the file does not parse or does not fit it. */
const yamlOf = <Schema extends z.ZodType>(schema: Schema, text: string): z.output<Schema> | undefined => {
	const document = parseDocument(text);
	const parsed = document.errors.length === 0 ? schema.safeParse(document.toJS()) : undefined;

	return parsed?.success ? parsed.data : undefined;
};

const commandsOf = (run: string): string[] =>
	run
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "" && !line.startsWith("#"));

/** The CI workflows' jobs. A workflow that does not parse is skipped, because the owner's CI is not setup's to judge. */
const ciJobsOf = (repo: string): CiJob[] =>
	filesIn(repo, `${WORKFLOW_FOLDER}/*.{yml,yaml}`).flatMap((file) => {
		const workflow = yamlOf(Workflow, textOf(repo, file));

		if (workflow === undefined) return [];

		const triggers = workflow.on;

		return Object.entries(workflow.jobs).map(([job, { steps, ...where }]) => ({
			file: basename(file),
			job,
			triggers,
			commands: steps.flatMap((step) => commandsOf(step.run ?? "")),
			runner: where["runs-on"],
			container: where.container,
			env: { ...workflow.env, ...where.env },
			actions: steps.flatMap((step) => (step.uses === undefined ? [] : [{ uses: step.uses, with: step.with }])),
		}));
	});

const codeownersOf = (repo: string): RepoScan["codeowners"] => {
	const file = CODEOWNERS_FILES.find((candidate) => doesExist(repo, candidate));

	return textOf(repo, file ?? "")
		.split("\n")
		.map((line) => line.replace(/#.*/, "").trim().split(/\s+/))
		.flatMap(([glob, ...owners]) => (glob === undefined || glob === "" || owners.length === 0 ? [] : [{ glob, owners }]));
};

const composeOf = (repo: string): RepoScan["composeServices"] => {
	const file = COMPOSE_FILES.find((candidate) => doesExist(repo, candidate));
	const compose = yamlOf(Compose, textOf(repo, file ?? ""));

	return compose ? Object.entries(compose.services).map(([name, { image }]) => ({ name, image })) : [];
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
		const template = yamlOf(Template, front);

		return template ? [{ file: basename(file), labels: [template.labels].flat().flatMap((label) => label.split(",").map((one) => one.trim()).filter(Boolean)) }] : [];
	});

const trackedOf = async (repo: string): Promise<string[]> => (await gitIn(repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }).raw(["ls-files"])).split("\n").filter(Boolean).slice(0, TRACKED_FILE_LIMIT);

const topFolder = (path: string): string => (path.includes("/") ? (path.split("/")[0] ?? path) : "");

/** Each top-level folder's merged changes on the base, from the history setup reads. */
const foldersOf = async (repo: string, base: string): Promise<FolderHistory[]> => {
	const git = gitIn(repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	const log = await git.run(["rev-parse", "--verify", "-q", base]);

	if (log.code !== 0) return [];

	const touches = (await readHistory(git, base, SHIPPED_DEFAULTS)).flatMap(({ files, size }) => [...new Set(files.map(topFolder).filter(Boolean))].map((folder) => ({ folder, size })));

	return [...new Set(touches.map(({ folder }) => folder))].map((folder) => {
		const sizes = touches.flatMap((touch) => (touch.folder === folder ? [touch.size] : []));

		return { folder, changes: sizes.length, sizes: sizes.toReversed() };
	});
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
	const lockfile = Object.entries(LOCKFILES).find(([file]) => doesExist(repo, file));

	return {
		packageManager: lockfile?.[1],
		scripts,
		ci: ciJobsOf(repo),
		codeowners: codeownersOf(repo),
		composeServices: composeOf(repo),
		envScripts: envScriptsOf(repo),
		setupTargets: setupTargetsOf(repo, scripts),
		toolVersions: TOOL_VERSION_FILES.filter((file) => doesExist(repo, file)),
		envExamples: ENV_EXAMPLE_FILES.filter((file) => doesExist(repo, file)),
		envTooling: ENV_TOOLING_FILES.filter((file) => doesExist(repo, file)),
		issueTemplates: templatesOf(repo),
		tracked: await trackedOf(repo),
		folders: await foldersOf(repo, base),
		engine: { pinned },
		hum: { schemaVersion: humSchemaOf(repo) },
	};
};
