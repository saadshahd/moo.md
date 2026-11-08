import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { ADAPTER_API_VERSION, type Adapter, type AdapterContext, type AdapterFactory, PermanentError } from "../adapter-api.ts";
import { HumConfig } from "../config/schema.ts";
import type { Faults } from "../state/faults.ts";
import type { Card } from "../status/format.ts";
import { githubAdapter, repoFromRemote } from "./github.ts";
import { gitIn } from "./git.ts";
import { type GuardOptions, guarded } from "./guard.ts";
import { markdownAdapter } from "./markdown.ts";
import { roundupAdapter } from "./roundup.ts";

/** The integration slots `hum.json` `integrations` names, each to an adapter. */
export const SLOTS = ["work-source", "questions", "answers", "release"] as const;

export type Slot = (typeof SLOTS)[number];

const MARKDOWN = "markdown";
const FALLBACK_BASE = "main";

/** Slots that use the markdown source when `hum.json` names none; release has no default. */
const MARKDOWN_SLOTS: readonly Slot[] = ["work-source", "questions", "answers"];

/** What the adapters read from `hum.json`; every other key belongs to the worker. */
const AdapterSettings = z.looseObject({
	integrations: z.partialRecord(z.enum(SLOTS), z.string().min(1)).optional(),
	claimPrefix: HumConfig.shape.claimPrefix,
	itemsDir: HumConfig.shape.itemsDir,
	commitIdentity: HumConfig.shape.commitIdentity,
	readyLabel: HumConfig.shape.readyLabel,
	mergeMethod: HumConfig.shape.mergeMethod,
});

type AdapterSettings = z.infer<typeof AdapterSettings>;

const AdapterModule = z.looseObject({ default: z.custom<AdapterFactory>((value) => value instanceof Function, "must export an adapter factory as its default") });

/** The adapter a slot uses: the one `hum.json` names, else the markdown source where that is the default. */
const adapterNameFor = (slot: Slot, integrations: AdapterSettings["integrations"]): string | undefined =>
	integrations?.[slot] ?? (MARKDOWN_SLOTS.includes(slot) ? MARKDOWN : undefined);

type Repo = { readonly path: string; readonly settings: AdapterSettings; readonly context: AdapterContext };

const readSettings = (repo: string): AdapterSettings => {
	const path = join(repo, ".hum", "hum.json");

	return AdapterSettings.parse(existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
};

const defaultBase = async (repo: string): Promise<string> => {
	const head = await gitIn(repo)
		.raw(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
		.catch(() => `origin/${FALLBACK_BASE}`);

	return head.trim().replace(/^origin\//, "");
};

const githubRepo = async (repo: string): Promise<string> => {
	const found = repoFromRemote(await gitIn(repo).raw(["remote", "get-url", "origin"]));

	if (!found) throw new PermanentError("the github adapter needs an `origin` remote on github.com");

	return found;
};

/** The adapters the engine ships, by the name `hum.json` gives them. */
const BUILT_IN = {
	[MARKDOWN]: async ({ path, settings, context }) => markdownAdapter({ repo: path, base: await defaultBase(path), claimPrefix: settings.claimPrefix, itemsDir: settings.itemsDir, identity: settings.commitIdentity }, context),
	github: async ({ path, settings, context }) =>
		githubAdapter({ repo: await githubRepo(path), base: await defaultBase(path), claimPrefix: settings.claimPrefix, readyLabel: settings.readyLabel, mergeMethod: settings.mergeMethod }, context),
	roundup: async ({ context }) => roundupAdapter({}, context),
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

/**
 * The adapter `hum.json` names for each slot, guarded: one the engine ships, else an owner's `adapters/<name>.ts`.
 * A slot with no entry uses the markdown source in `repo`, except release, which has no default. Slots that name
 * the same adapter share one instance.
 */
export const resolveAdapters = async (
	repo: string,
	{ faults, guard, context }: { faults: Faults; guard: Omit<GuardOptions, "provider" | "faults">; context: AdapterContext },
): Promise<Partial<Record<Slot, Adapter>>> => {
	const settings = readSettings(repo);

	const slots = SLOTS.flatMap((slot) => {
		const name = adapterNameFor(slot, settings.integrations);

		return name === undefined ? [] : [[slot, name] as const];
	});

	const source: Repo = { path: repo, settings, context };

	const build = async (name: string): Promise<Adapter> => {
		const adapter = await (isBuiltIn(name) ? BUILT_IN[name](source) : ownerAdapter(name, source));

		if (refuseOtherVersion(name, adapter, faults)) throw new PermanentError(`adapter "${name}" implements another adapter API version`);

		return guarded(adapter, { ...guard, provider: name, faults });
	};

	const names = [...new Set(slots.map(([, name]) => name))];
	const built = new Map(await Promise.all(names.map(async (name) => [name, await build(name)] as const)));

	return Object.fromEntries(slots.map(([slot, name]) => [slot, built.get(name)]));
};
