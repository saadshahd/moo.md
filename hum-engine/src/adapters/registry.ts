import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { ADAPTER_API_VERSION, type Adapter, type AdapterContext, type AdapterFactory, type Integrations, PermanentError } from "../adapter-api.ts";
import { readSettings } from "../config/settings.ts";
import { defaultStateDir } from "../state/open.ts";
import { HumConfig, SLOTS, type Slot } from "../config/schema.ts";
import { commandTimeoutMs, type Env } from "../exec.ts";
import type { Faults } from "../state/faults.ts";
import type { Card } from "../status/format.ts";
import { githubAdapter, repoFromRemote } from "./github.ts";
import { gitIn, whenGitFailed } from "./git.ts";
import { type GuardOptions, guardTimings, guarded } from "./guard.ts";
import { markdownAdapter } from "./markdown.ts";
import { gitHubPullRequests, type PullRequests } from "./pull-requests.ts";
import { ROUNDUP, roundupAdapter } from "./roundup.ts";

export { SLOTS, type Slot } from "../config/schema.ts";

const MARKDOWN = "markdown";
const FALLBACK_BASE = "main";

/** Slots that use the markdown source when `hum.json` names none; release has no default. */
const MARKDOWN_SLOTS: readonly Slot[] = ["work-source", "questions", "answers"];

/** What the adapters read from `hum.json`; every other key belongs to the worker. */
const AdapterSettings = z.looseObject({
	integrations: HumConfig.shape.integrations,
	claimPrefix: HumConfig.shape.claimPrefix,
	runBranchPrefix: HumConfig.shape.runBranchPrefix,
	itemsDir: HumConfig.shape.itemsDir,
	roundupWorkstream: HumConfig.shape.roundupWorkstream,
	models: HumConfig.shape.models,
	deniedRunCommands: HumConfig.shape.deniedRunCommands,
	runAutoMode: HumConfig.shape.runAutoMode,
	commitIdentity: HumConfig.shape.commitIdentity,
	readyLabel: HumConfig.shape.readyLabel,
	ownerLogins: HumConfig.shape.ownerLogins,
	mergeMethod: HumConfig.shape.mergeMethod,
	alwaysPullRequest: HumConfig.shape.alwaysPullRequest,
	ownerBranchPrefix: HumConfig.shape.ownerBranchPrefix,
	growthLabels: HumConfig.shape.growthLabels,
	writeRaceRetries: HumConfig.shape.writeRaceRetries,
	itemReadsAtOnce: HumConfig.shape.itemReadsAtOnce,
	providerTimeoutSeconds: HumConfig.shape.providerTimeoutSeconds,
	providerBackoff: HumConfig.shape.providerBackoff,
	commandTimeoutSeconds: HumConfig.shape.commandTimeoutSeconds,
});

type AdapterSettings = z.infer<typeof AdapterSettings>;

const AdapterModule = z.looseObject({ default: z.custom<AdapterFactory>((value) => value instanceof Function, "must export an adapter factory as its default") });

/** The adapter a slot uses: the one `hum.json` names, else the markdown source where that is the default. */
const adapterNameFor = (slot: Slot, integrations: AdapterSettings["integrations"]): string | undefined =>
	integrations?.[slot] ?? (MARKDOWN_SLOTS.includes(slot) ? MARKDOWN : undefined);

type Repo = { readonly path: string; readonly settings: AdapterSettings; readonly context: AdapterContext };

const defaultBase = async (repo: string, timeoutMs: number): Promise<string> => {
	const head = await gitIn(repo, { timeoutMs })
		.raw(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
		.catch(whenGitFailed(`origin/${FALLBACK_BASE}`));

	return head.trim().replace(/^origin\//, "");
};

/** The pull requests of the repo's `origin` when it is on GitHub. */
const originPulls = async (repo: string, timeoutMs: number, env: Env): Promise<PullRequests | undefined> => {
	const found = repoFromRemote(await gitIn(repo, { timeoutMs }).raw(["remote", "get-url", "origin"]).catch(whenGitFailed("")));

	return found === undefined ? undefined : gitHubPullRequests(found, { timeoutMs, env });
};

const githubRepo = async (repo: string, timeoutMs: number): Promise<string> => {
	const found = repoFromRemote(await gitIn(repo, { timeoutMs }).raw(["remote", "get-url", "origin"]));

	if (!found) throw new PermanentError("the github adapter needs an `origin` remote on github.com");

	return found;
};

/** The adapters the engine ships, by the name `hum.json` gives them. */
const BUILT_IN = {
	[MARKDOWN]: async ({ path, settings, context }) => {
		const timeoutMs = commandTimeoutMs(settings);

		return markdownAdapter({ repo: path, base: await defaultBase(path, timeoutMs), claimPrefix: settings.claimPrefix, itemsDir: settings.itemsDir, identity: settings.commitIdentity, writeRaceRetries: settings.writeRaceRetries, itemReadsAtOnce: settings.itemReadsAtOnce, pulls: await originPulls(path, timeoutMs, context.env), mergeMethod: settings.mergeMethod, alwaysPullRequest: settings.alwaysPullRequest, ownerBranchPrefix: settings.ownerBranchPrefix, growthLabels: settings.growthLabels, timeoutMs }, context);
	},
	github: async ({ path, settings, context }) => {
		const timeoutMs = commandTimeoutMs(settings);

		return githubAdapter({ repo: await githubRepo(path, timeoutMs), base: await defaultBase(path, timeoutMs), claimPrefix: settings.claimPrefix, runBranchPrefix: settings.runBranchPrefix, readyLabel: settings.readyLabel, mergeMethod: settings.mergeMethod, ownerLogins: settings.ownerLogins, timeoutMs }, context);
	},
	[ROUNDUP]: async ({ path, settings, context }) => roundupAdapter({ workstream: settings.roundupWorkstream, stateDir: await defaultStateDir(path), repo: path, config: settings }, context),
} satisfies Readonly<Record<string, (repo: Repo) => Promise<Adapter>>>;

const isBuiltIn = (name: string): name is keyof typeof BUILT_IN => Object.hasOwn(BUILT_IN, name);

/** An owner's adapter: the default export of `adapters/<name>.ts` in the repo. */
const ownerAdapter = async (name: string, { path, context }: Repo): Promise<Adapter> => {
	const file = join(path, "adapters", `${name}.ts`);

	if (!existsSync(file)) throw new PermanentError(`no adapter "${name}": the engine ships ${Object.keys(BUILT_IN).join(", ")}, and ${file} does not exist`);

	const loaded = AdapterModule.safeParse(await import(pathToFileURL(file).href));

	if (!loaded.success) throw new PermanentError(`${file}: ${loaded.error.issues[0]?.message}`);

	return loaded.data.default(context);
};

/** The card that refuses an adapter written for another API version; undefined for one written for this engine. */
export const refuseOtherVersion = (name: string, adapter: Adapter, faults: Faults): Card | undefined => {
	if (adapter.apiVersion === ADAPTER_API_VERSION) return undefined;

	return faults.raise({
		code: "adapter-api-mismatch",
		item: name,
		cause: `Adapter "${name}" implements adapter API ${adapter.apiVersion}; this engine runs ${ADAPTER_API_VERSION}.`,
		fix: `Update ${name} to adapter API ${ADAPTER_API_VERSION}.`,
	});
};

/** The integrations of each slot, and how to end what their adapters hold open once the caller is done with them. */
export type Resolved = { readonly slots: Partial<Record<Slot, Integrations>>; readonly close: () => Promise<void> };

/**
 * The adapter `hum.json` names for each slot, guarded: one the engine ships, else an owner's `adapters/<name>.ts`.
 * A slot with no entry uses the markdown source in `repo`, except release, which has no default. Slots that name
 * the same adapter share one instance, which `close` ends once.
 */
export const resolveAdapters = async (
	repo: string,
	{ faults, guard, context }: { faults: Faults; guard: Pick<GuardOptions, "lastReady">; context: AdapterContext },
): Promise<Resolved> => {
	const settings = readSettings(repo, AdapterSettings);

	const slots = SLOTS.flatMap((slot) => {
		const name = adapterNameFor(slot, settings.integrations);

		return name === undefined ? [] : [[slot, name] as const];
	});

	const source: Repo = { path: repo, settings, context };

	const build = async (name: string) => {
		const adapter: Adapter = await (isBuiltIn(name) ? BUILT_IN[name](source) : ownerAdapter(name, source));

		if (refuseOtherVersion(name, adapter, faults)) throw new PermanentError(`adapter "${name}" implements another adapter API version`);

		const integrations = guarded(adapter, {
			...guard,
			provider: name,
			faults,
			...guardTimings(settings),
		});

		return { integrations, close: async () => void (await adapter.close?.()) };
	};

	const names = [...new Set(slots.map(([, name]) => name))];
	const built = new Map(await Promise.all(names.map(async (name) => [name, await build(name)] as const)));

	return {
		slots: Object.fromEntries(slots.map(([slot, name]) => [slot, built.get(name)?.integrations])),
		close: async () => void (await Promise.all([...built.values()].map(({ close }) => close()))),
	};
};
