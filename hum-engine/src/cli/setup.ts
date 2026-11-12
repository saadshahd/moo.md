import { join } from "node:path";
import type { Command } from "commander";
import { x } from "tinyexec";
import { z } from "zod";
import type { Item } from "../adapter-api.ts";
import { gitIn, readGitIdentity } from "../adapters/git.ts";
import { listHopeSkills } from "../config/load.ts";
import { HumConfig } from "../config/schema.ts";
import { CommandTimedOut, exec, SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { readSettings } from "../config/settings.ts";
import { kindCoverage, proposeSetup } from "../setup/propose.ts";
import { proveSetup, type Step } from "../setup/prove.ts";
import { scanRepo } from "../setup/scan.ts";
import { shippedConfig } from "../setup/shipped.ts";
import { waitsOf } from "../setup/waits.ts";
import { readAnswers, writeSetup } from "../setup/write.ts";
import type { Io } from "./ops.ts";
import { hopeRoot } from "./service.ts";

const EXIT_OK = 0;
const EXIT_FAILED = 1;

const DEFAULT_BASE = "main";

const GH_LIST_LIMIT = "200";

const GhIssues = z.array(z.object({ body: z.string().default(""), labels: z.array(z.object({ name: z.string() })).default([]) }));

const GhLabels = z.array(z.object({ name: z.string() }));

const EVAL_SCRIPT = join(import.meta.dir, "..", "..", "scripts", "eval.ts");

type GithubFacts = {
	readonly items: readonly Pick<Item, "body" | "labels">[];
	readonly labels: readonly string[];
	/** Whether the repo lets a workflow open pull requests; off, a CI run cannot open one at all. */
	readonly workflowsMayOpenPullRequests: boolean;
};

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

type GhOutput = Awaited<ReturnType<typeof gh>>;

const isRead = (output: GhOutput): output is NonNullable<GhOutput> => output?.exitCode === 0;

/** The repo's open issues and its label names, from `gh`. Without `gh` or a GitHub remote there are none, and the scan prints no coverage. */
const githubFacts = async (repo: string): Promise<GithubFacts | undefined> => {
	const issues = await gh(repo, ["issue", "list", "--state", "open", "--limit", GH_LIST_LIMIT, "--json", "body,labels"]);
	const labels = await gh(repo, ["label", "list", "--limit", GH_LIST_LIMIT, "--json", "name"]);

	const permissions = await gh(repo, ["api", "repos/{owner}/{repo}/actions/permissions/workflow"]);

	if (!isRead(issues) || !isRead(labels) || !isRead(permissions)) return undefined;

	return {
		items: GhIssues.parse(JSON.parse(issues.stdout)).map(({ body, labels: on }) => ({ body, labels: on.map(({ name }) => name) })),
		labels: GhLabels.parse(JSON.parse(labels.stdout)).map(({ name }) => name),
		workflowsMayOpenPullRequests: WorkflowPermissions.parse(JSON.parse(permissions.stdout)).can_approve_pull_request_reviews,
	};
};

const printStep = ({ name, status, detail, ms }: Step): string => `${status.padEnd(7)} ${name} (${ms} ms): ${detail}`;

const ModelSettings = z.looseObject({ models: HumConfig.shape.models, decisionModel: HumConfig.shape.decisionModel });

/** The distinct model ids the owner's tiers and cheap call run on. */
const modelsOf = (repo: string): string[] => {
	const { models, decisionModel } = readSettings(repo, ModelSettings);

	return [...new Set([...Object.values(models), decisionModel])];
};

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
			const proposal = proposeSetup(scan, shipped.hum, facts?.labels);
			const { tracked, folders, ...shown } = scan;
			const coverage = facts && kindCoverage(facts.items, shipped.hum.kinds, proposal.kindLabels);
			const gitIdentity = await readGitIdentity(setupGit(io.cwd));

			io.stdout(`${JSON.stringify({ scan: { ...shown, trackedFiles: tracked.length, folders: folders.map(({ folder, changes }) => ({ folder, changes })) }, proposal, waits: waitsOf(shipped.kinds), coverage: coverage ?? null, workflowsMayOpenPullRequests: facts?.workflowsMayOpenPullRequests ?? null, gitIdentity }, null, "\t")}\n`);
		});

	setup
		.command("write")
		.description("Write .hum/ and the service files from the answers file, or write nothing and say why.")
		.requiredOption("--answers <file>", 'JSON: { "hum": {settings}, "waitHours": { "kind/state": hours }, "schemaVersion": 1 }')
		.option("--home <folder>", "where the service unit goes; default the user's home")
		.action(async ({ answers, home }: { answers: string; home?: string }) => {
			const result = writeSetup(io.cwd, readAnswers(answers), { hopeSkills: listHopeSkills(await hopeRoot()), home, gitIdentity: await readGitIdentity(setupGit(io.cwd)) });

			io.stdout(`${JSON.stringify(result.ok ? { written: result.written } : { refused: result.refusal.message }, null, "\t")}\n`);
			done(result.ok ? EXIT_OK : EXIT_FAILED);
		});

	setup
		.command("prove")
		.description("Prove the written setup: config checks, each check alone, the contract suite, the pinned engine, one slot, and with --item one item end to end.")
		.option("--base <branch>", "the branch items merge into", DEFAULT_BASE)
		.option("--item", "run one item through the real claude on a scratch copy; spends live calls")
		.action(async ({ base, item }: { base: string; item?: true }) => {
			const steps = await proveSetup(io.cwd, { now: Date.now, hopeSkills: listHopeSkills(await hopeRoot()), base, item: item === true });

			io.stdout(`${steps.map(printStep).join("\n")}\n`);
			done(steps.some(({ status }) => status === "failed") ? EXIT_FAILED : EXIT_OK);
		});

	setup
		.command("measure")
		.description("Measure the owner's models on every labelled set and record the pooled rates in .hum/hum.json.")
		.option("--runs <n>", "runs pooled per boundary", "3")
		.option("--model <id...>", "model ids to measure; default every model the tiers and the cheap call use")
		.action(async ({ runs, model }: { runs: string; model?: string[] }) => {
			for (const id of model ?? modelsOf(io.cwd)) {
				const ran = await x(process.execPath, [EVAL_SCRIPT, "--model", id, "--runs", runs, "--write", join(io.cwd, ".hum")], { throwOnError: false, nodeOptions: { cwd: io.cwd, stdio: "inherit" } });

				if (ran.exitCode !== 0) return done(EXIT_FAILED);
			}

			done(EXIT_OK);
		});
};
