import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import { z } from "zod";
import type { Item } from "../adapter-api.ts";
import { gitIn, readGitIdentity } from "../adapters/git.ts";
import { HumConfig, SCHEMA_VERSION } from "../config/schema.ts";
import { runModels } from "../measure/judges.ts";
import { measureOn } from "../measure/remeasure.ts";
import { CommandTimedOut, exec, SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { readSettings } from "../config/settings.ts";
import { kindCoverage, proposeSetup } from "../setup/propose.ts";
import { proveSetup, type Step } from "../setup/prove.ts";
import { scanRepo } from "../setup/scan.ts";
import { shippedConfig } from "../setup/shipped.ts";
import { waitsOf } from "../setup/waits.ts";
import { readAnswers, writeSetup } from "../setup/write.ts";
import type { Io } from "./ops.ts";
import { installedSkills } from "./service.ts";

const EXIT_OK = 0;
const EXIT_FAILED = 1;

const DEFAULT_BASE = "main";

const GH_LIST_LIMIT = "200";

const GhIssues = z.array(z.object({ body: z.string().default(""), labels: z.array(z.object({ name: z.string() })).default([]) }));

const GhLabels = z.array(z.object({ name: z.string() }));

/** What the scan reads from GitHub. Each fact is read alone, and one whose read fails is unknown while the rest stand. */
type GithubFacts = {
	readonly items: readonly Pick<Item, "body" | "labels">[] | undefined;
	readonly labels: readonly string[] | undefined;
	/** Whether the repo lets a workflow open pull requests; off, a CI run cannot open one at all. */
	readonly workflowsMayOpenPullRequests: boolean | undefined;
};

const Visibility = z.object({ visibility: z.string() });

const WorkflowPermissions = z.object({ can_approve_pull_request_reviews: z.boolean() });

/** Setup reads before any `hum.json` is written, so its commands run on the shipped time limit. */
const setupGit = (repo: string) => gitIn(repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

/** `gh` in the repo, or nothing where `gh` is not installed; a `gh` that outruns its limit is an error. */
const gh = async (repo: string, args: readonly string[]) => {
	try {
		return await exec("gh", args, { throwOnError: false, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS, nodeOptions: { cwd: repo } });
	} catch (error) {
		if (error instanceof CommandTimedOut) throw error;

		return undefined;
	}
};

/**
 * What one `gh` read prints, through `parse`; undefined where the read fails: without `gh` or a GitHub remote, or
 * without the rights it needs, as a read that needs admin fails for anyone else.
 */
const ghRead = async <T>(repo: string, args: readonly string[], parse: (stdout: string) => T): Promise<T | undefined> => {
	const output = await gh(repo, args);

	return output?.exitCode === 0 ? parse(output.stdout) : undefined;
};

/** Whether anyone may read and comment on the repo; undefined where `gh` cannot read it. */
const isPublicRepo = (repo: string): Promise<boolean | undefined> => ghRead(repo, ["repo", "view", "--json", "visibility"], (stdout) => Visibility.parse(JSON.parse(stdout)).visibility === "PUBLIC");

/** The repo's open issues, its label names and its workflow permissions, from `gh`. Without the open issues and the labels both read, the scan prints no coverage, as the issues are counted against the labels. */
const githubFacts = async (repo: string): Promise<GithubFacts> => ({
	items: await ghRead(repo, ["issue", "list", "--state", "open", "--limit", GH_LIST_LIMIT, "--json", "body,labels"], (stdout) =>
		GhIssues.parse(JSON.parse(stdout)).map(({ body, labels }) => ({ body, labels: labels.map(({ name }) => name) })),
	),
	labels: await ghRead(repo, ["label", "list", "--limit", GH_LIST_LIMIT, "--json", "name"], (stdout) => GhLabels.parse(JSON.parse(stdout)).map(({ name }) => name)),
	workflowsMayOpenPullRequests: await ghRead(repo, ["api", "repos/{owner}/{repo}/actions/permissions/workflow"], (stdout) => WorkflowPermissions.parse(JSON.parse(stdout)).can_approve_pull_request_reviews),
});

const printStep = ({ name, status, detail, ms }: Step): string => `${status.padEnd(7)} ${name} (${ms} ms): ${detail}`;

const MeasureSettings = z.looseObject({ models: HumConfig.shape.models, decisionModel: HumConfig.shape.decisionModel, evalRuns: HumConfig.shape.evalRuns });

const Runs = z.coerce.number().int().positive();

/** `hum setup scan | write | prove | measure`: the facts and writes behind the /hum skill. */
export const addSetupCommands = (root: Command, io: Io, done: (code: number) => void): void => {
	const setup = root.command("setup").description("What the /hum skill calls: read the repo, write .hum/, prove it, measure the owner's models.");

	setup
		.command("scan")
		.description("Read the repo and print what setup proposes: checks, paths, data and secrets globs, kind labels, the slot recipe, and a timeout question per wait.")
		.option("--base <branch>", "the branch items merge into", DEFAULT_BASE)
		.action(async ({ base }: { base: string }) => {
			const shipped = shippedConfig();
			const scan = await scanRepo(io.cwd, base);
			const facts = await githubFacts(io.cwd);
			const isPublic = await isPublicRepo(io.cwd);
			const proposal = proposeSetup(scan, shipped.hum, { labels: facts.labels, isPublic: isPublic ?? true, openIssues: facts.items?.length });
			const { tracked, folders, ...shown } = scan;
			const coverage = facts.items && facts.labels && kindCoverage(facts.items, shipped.hum.kinds, proposal.kindLabels);
			const gitIdentity = await readGitIdentity(setupGit(io.cwd));

			io.stdout(`${JSON.stringify({ scan: { ...shown, trackedFiles: tracked.length, folders: folders.map(({ folder, changes }) => ({ folder, changes })) }, proposal, waits: waitsOf(shipped.kinds), coverage: coverage ?? null, workflowsMayOpenPullRequests: facts.workflowsMayOpenPullRequests ?? null, isPublicRepo: isPublic ?? null, gitIdentity }, null, "\t")}\n`);
		});

	setup
		.command("write")
		.description("Write .hum/ and the service files from the answers file, or write nothing and say why.")
		.requiredOption("--answers <file>", `JSON: { "hum": {settings}, "waitHours": { "kind/state": hours }, "schemaVersion": ${SCHEMA_VERSION} }`)
		.option("--home <folder>", "where the service unit goes; default the user's home")
		.action(async ({ answers, home }: { answers: string; home?: string }) => {
			const result = writeSetup(io.cwd, readAnswers(answers), { installedSkills: await installedSkills(), home, gitIdentity: await readGitIdentity(setupGit(io.cwd)), isPublicRepo: await isPublicRepo(io.cwd) });

			io.stdout(`${JSON.stringify(result.ok ? { written: result.written } : { refused: result.refusal.message }, null, "\t")}\n`);
			done(result.ok ? EXIT_OK : EXIT_FAILED);
		});

	setup
		.command("prove")
		.description("Prove the written setup: config checks, each check alone, the contract suite, the pinned engine, one slot, and with --item one item end to end.")
		.option("--base <branch>", "the branch items merge into", DEFAULT_BASE)
		.option("--item", "run one item through the real claude on a scratch copy; spends live calls")
		.action(async ({ base, item }: { base: string; item?: true }) => {
			const steps = await proveSetup(io.cwd, { now: Date.now, processEnv: io.env, newSessionId: randomUUID, installedSkills: await installedSkills(), base, item: item === true });

			io.stdout(`${steps.map(printStep).join("\n")}\n`);
			done(steps.some(({ status }) => status === "failed") ? EXIT_FAILED : EXIT_OK);
		});

	setup
		.command("measure")
		.description("Measure the owner's models on every labelled set and record the pooled rates in .hum/hum.json.")
		.option("--runs <n>", "runs pooled per boundary; default evalRuns in hum.json")
		.option("--model <id...>", "model ids to measure; default every model the tiers and the cheap call use")
		.action(async ({ runs, model }: { runs?: string; model?: string[] }) => {
			const settings = readSettings(io.cwd, MeasureSettings);

			for (const id of model ?? runModels(settings)) {
				const measured = await measureOn(io.cwd, { model: id, runs: runs === undefined ? settings.evalRuns : Runs.parse(runs) }, { inherit: true });

				if (!measured.ok) return done(EXIT_FAILED);
			}

			done(EXIT_OK);
		});
};
