import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { AdapterContext } from "../adapter-api.ts";
import { runContract } from "../adapters/contract.ts";
import { markdownAdapter } from "../adapters/markdown.ts";
import { type Config, loadConfig, readConfigDir } from "../config/load.ts";
import { commandTimeoutMs, exec, SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";
import { SlotPool } from "../slots/pool.ts";
import { orMissing } from "../state/fs.ts";
import { openState } from "../state/open.ts";
import { checksTimeoutMs, runChecks } from "../worker/checks.ts";
import { openWorker } from "../worker/open.ts";
import { Scratch } from "./scratch.ts";

type StepStatus = "passed" | "failed" | "skipped";

/** One thing setup proved, with how long it took. A skip says why, so nothing passes silently. */
export type Step = { readonly name: string; readonly status: StepStatus; readonly detail: string; readonly ms: number };

type Outcome = { readonly status: StepStatus; readonly detail: string };

const passed = (detail: string): Outcome => ({ status: "passed", detail });

const failed = (detail: string): Outcome => ({ status: "failed", detail });

const skipped = (detail: string): Outcome => ({ status: "skipped", detail });

const stepOf = (name: string, outcome: Outcome, started: number): Step => ({ name, status: outcome.status, detail: outcome.detail, ms: Math.round(performance.now() - started) });

/** Runs one step; a throw is the step failing, in the error's own words. */
const timed = async (name: string, run: () => Promise<Outcome>): Promise<Step> => {
	const started = performance.now();

	return stepOf(name, await run().catch((error: Error) => failed(error.message)), started);
};

export type ProveEnv = {
	readonly now: () => number;
	readonly hopeSkills: ReadonlySet<string>;
	readonly base: string;
	/** Whether to run one item end to end through the real `claude`; each run spends live calls. */
	readonly item: boolean;
	/** Reads the registry for the pinned engine: the package's versions, or undefined while it is not published. */
	readonly published?: (pin: string) => Promise<"found" | "missing-version" | "unpublished">;
};

const Manifest = z.looseObject({
	dependencies: z.record(z.string(), z.string()).default({}),
	devDependencies: z.record(z.string(), z.string()).default({}),
});

const ENGINE = "@moo.md/hum";

/** A pin that is a folder or tarball on disk rather than a registry version. */
const LOCAL_PIN = /^(file|link):/;

/** What the registry says about the pinned version: found, or the package exists without it, or the package is not published. */
const npmPublished = async (pin: string): Promise<"found" | "missing-version" | "unpublished"> => {
	const viewed = await exec("npm", ["view", `${ENGINE}@${pin}`, "version"], { throwOnError: false, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

	if (viewed.exitCode === 0) return "found";

	const package_ = await exec("npm", ["view", ENGINE, "name"], { throwOnError: false, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

	return package_.exitCode === 0 ? "missing-version" : "unpublished";
};

const pinOf = (repo: string): string | undefined => {
	const manifest = Manifest.parse(orMissing(() => JSON.parse(readFileSync(join(repo, "package.json"), "utf8")), {}));

	return { ...manifest.dependencies, ...manifest.devDependencies }[ENGINE];
};

const configStep = (repo: string, env: ProveEnv): Outcome & { readonly config?: Config } => {
	const loaded = loadConfig(readConfigDir(join(repo, ".hum")), { env: { hopeSkills: env.hopeSkills } });

	return loaded.ok ? { ...passed("every state is reachable, reaches done or stuck, and every wait has a timeout"), config: loaded.value } : failed(loaded.refusal.message);
};

const checksStep = async (repo: string, config: Config): Promise<Outcome> => {
	if (config.hum.checks.length === 0) return failed('hum.json names no checks: set "checks"');

	for (const check of config.hum.checks) {
		const failure = await runChecks([check], repo, { timeoutMs: checksTimeoutMs(config.hum) });

		if (failure) return failed(failure);
	}

	return passed(`${config.hum.checks.length} check(s), each run alone`);
};

const markdownOver = (repo: string, base: string, hum: Config["hum"], context: AdapterContext) =>
	markdownAdapter({ repo, base, claimPrefix: hum.claimPrefix, itemsDir: hum.itemsDir, identity: hum.commitIdentity, writeRaceRetries: hum.writeRaceRetries, itemReadsAtOnce: hum.itemReadsAtOnce, mergeMethod: hum.mergeMethod, ownerBranchPrefix: hum.ownerBranchPrefix, timeoutMs: commandTimeoutMs(hum) }, context);

const contractStep = async (config: Config, scratch: Scratch, { base, now }: Pick<ProveEnv, "base" | "now">): Promise<Outcome> => {
	const others = Object.entries(config.hum.integrations ?? {}).filter(([, adapter]) => adapter !== "markdown");

	if (others.length > 0) return skipped(`${others.map(([slot, adapter]) => `${slot}: ${adapter}`).join(", ")} write to a live target; run its contract suite there`);

	let skew = 0;
	let count = 0;

	const context: AdapterContext = { report: () => {}, now: () => now() + skew };
	const first = markdownOver(await scratch.worker(), base, config.hum, context);
	const second = markdownOver(await scratch.worker(), base, config.hum, context);

	const results = await runContract({
		name: "markdown",
		adapter: first,
		other: async () => second,
		seed: (title) => scratch.seed(`contract-${++count}`, title, "body"),
		advance: async (ms) => void (skew += ms),
		spent: () => first.spent(),
	});

	const broken = results.filter(({ failure }) => failure !== undefined);

	return broken.length === 0 ? passed(`${results.length} contract checks on the markdown source`) : failed(broken.map(({ name, failure }) => `${name}: ${failure}`).join("\n"));
};

const pinStep = async (repo: string, env: ProveEnv): Promise<Outcome> => {
	const pin = pinOf(repo);

	if (pin === undefined) return failed(`package.json pins no ${ENGINE}: run bun add --exact ${ENGINE}@<version>`);

	if (LOCAL_PIN.test(pin)) return passed(`${ENGINE} is pinned to ${pin}, a path on this machine`);

	const found = await (env.published ?? npmPublished)(pin);

	if (found === "found") return passed(`${ENGINE}@${pin} is on the registry, so each runner installs it`);

	return found === "unpublished" ? skipped(`${ENGINE} is not published yet, so no runner can install it; run this step again after the first publish`) : failed(`${ENGINE}@${pin} is not on the registry`);
};

const slotStep = async (config: Config, scratch: Scratch, env: ProveEnv): Promise<Outcome> => {
	if (!config.hum.runSlots.enabled) return skipped("run slots are off in hum.json");

	const pool = mkdtempSync(join(tmpdir(), "hum-prove-slots-"));
	const state = openState(mkdtempSync(join(tmpdir(), "hum-prove-state-")));
	const slots = new SlotPool({ repo: scratch.owner, state, config: { ...config.hum, runners: 1, runSlots: { ...config.hum.runSlots, pool } }, base: env.base, now: env.now });
	const started = performance.now();

	await slots.maintain();

	const [slot] = slots.list();
	const cards = state.faults.list().map(({ cause }) => cause);

	return slot?.status === "free" ? passed(`one slot prepared and ready in ${Math.round(performance.now() - started)} ms`) : failed(`the slot ended ${slot?.status ?? "missing"}: ${cards.join("; ")}`);
};

const SETUP_ITEM = { id: "hum-setup-proof", title: "Add a file named hum-setup-proof.md that says hello", body: "Kind: docs\n\nAdd a file named hum-setup-proof.md at the repo root with the single line: hello." } as const;

/** The item runs on a copy of its own, since the contract suite leaves ready items on the copy it used. */
const itemStep = async (repo: string, config: Config, env: ProveEnv): Promise<Outcome> => {
	if (!env.item) return skipped("run without --item: no live run was made");

	if (Bun.which("claude") === null) return skipped("claude is not installed on this machine");

	const scratch = await Scratch.from(repo, env.base, config.hum);

	try {
		return await runItem(scratch, env);
	} finally {
		scratch.dispose();
	}
};

const runItem = async (scratch: Scratch, env: ProveEnv): Promise<Outcome> => {
	await scratch.seed(SETUP_ITEM.id, SETUP_ITEM.title, SETUP_ITEM.body);

	const results: string[] = [];

	const worker = await openWorker(scratch.owner, {
		now: env.now,
		hopeSkills: env.hopeSkills,
		holder: "setup-proof",
		base: env.base,
		where: "ci",
		stateDir: mkdtempSync(join(tmpdir(), "hum-prove-state-")),
		workDir: mkdtempSync(join(tmpdir(), "hum-prove-work-")),
		onResult: (result) => results.push(result.outcome),
	});

	await worker.tick();
	await worker.idle();

	return results.includes("merged") ? passed("one item ran end to end and merged") : failed(`the item ended as ${results.join(", ") || "nothing"}`);
};

/**
 * Proves a written setup: the config passes every check, each repo check passes alone, the markdown source passes its
 * contract suite on a scratch copy, the pinned engine is installable, one slot is ready, and one item runs end to end
 * on the scratch copy. Each part is its own step, so one failing hides no other.
 */
export const proveSetup = async (repo: string, env: ProveEnv): Promise<Step[]> => {
	const started = performance.now();
	const { config, ...outcome } = configStep(repo, env);
	const configured = stepOf("config", outcome, started);

	if (!config) return [configured];

	const scratch = await Scratch.from(repo, env.base, config.hum);

	try {
		return [
			configured,
			await timed("checks", () => checksStep(repo, config)),
			await timed("contract", () => contractStep(config, scratch, env)),
			await timed("engine pin", () => pinStep(repo, env)),
			await timed("slot", () => slotStep(config, scratch, env)),
			await timed("item", () => itemStep(repo, config, env)),
		];
	} finally {
		scratch.dispose();
	}
};
