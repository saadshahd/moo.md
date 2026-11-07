import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { ADAPTER_API_VERSION, type Adapter, type AdapterContext, type AdapterFactory, PermanentError } from "../adapter-api.ts";
import type { Faults } from "../state/faults.ts";
import { runGit } from "./git.ts";
import { type GuardOptions, guarded } from "./guard.ts";
import { markdownAdapter } from "./markdown.ts";

/** The integration slots `hum.json` `integrations` names, each to an adapter. */
export const SLOTS = ["work-source", "questions", "answers", "release"] as const;

export type Slot = (typeof SLOTS)[number];

/** Slots that default to the markdown source when `hum.json` names none. */
const MARKDOWN_DEFAULT: readonly Slot[] = ["work-source", "questions", "answers"];

const Integrations = z.looseObject({ integrations: z.partialRecord(z.enum(SLOTS), z.string()).optional() });

const AdapterModule = z.looseObject({ default: z.custom<AdapterFactory>((value) => value instanceof Function, "must export an adapter factory as its default") });

const defaultBase = async (cwd: string): Promise<string> => {
	const head = await runGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd });

	return head.code === 0 ? head.stdout.trim().replace(/^origin\//, "") : "main";
};

/** V11: an adapter written for another API version is refused with one card. */
export const refuseOtherVersion = (name: string, adapter: Adapter, faults: Faults): boolean => {
	if (adapter.apiVersion === ADAPTER_API_VERSION) return false;

	faults.raise({
		code: "adapter-api-mismatch",
		item: name,
		cause: `Adapter "${name}" implements adapter API ${adapter.apiVersion}; this engine runs ${ADAPTER_API_VERSION}.`,
		fix: `Update ${name} to adapter API ${ADAPTER_API_VERSION}.`,
	});

	return true;
};

/**
 * The adapters `hum.json` names for each slot: the engine's own, else an owner's `adapters/<name>.ts`.
 * An integration with no entry uses the markdown source in `repo`, except release, which has no default.
 */
export const resolveAdapters = async (
	repo: string,
	{ faults, guard, context }: { faults: Faults; guard: Omit<GuardOptions, "provider" | "faults">; context: AdapterContext },
): Promise<Partial<Record<Slot, Adapter>>> => {
	const configPath = join(repo, ".hum", "hum.json");
	const named = existsSync(configPath) ? (Integrations.parse(JSON.parse(readFileSync(configPath, "utf8"))).integrations ?? {}) : {};
	const names = new Map<Slot, string>(MARKDOWN_DEFAULT.map((slot) => [slot, "markdown"]));

	for (const [slot, adapterName] of Object.entries(named)) {
		const known = z.enum(SLOTS).safeParse(slot);

		if (!known.success) throw new PermanentError(`hum.json integrations names slot "${slot}"; the slots are ${SLOTS.join(", ")}`);

		names.set(known.data, adapterName);
	}

	const built = new Map<string, Adapter>();

	const adapterNamed = async (name: string): Promise<Adapter> => {
		const known = built.get(name);

		if (known) return known;

		let adapter: Adapter;

		if (name === "markdown") adapter = markdownAdapter({ repo, base: await defaultBase(repo) }, context);
		else {
			const file = join(repo, "adapters", `${name}.ts`);

			if (!existsSync(file)) throw new PermanentError(`no adapter "${name}": the engine ships markdown, and ${file} does not exist`);

			const loaded = AdapterModule.safeParse(await import(pathToFileURL(file).href));

			if (!loaded.success) throw new PermanentError(`${file}: ${loaded.error.issues[0]?.message}`);

			adapter = await loaded.data.default(context);
		}

		if (refuseOtherVersion(name, adapter, faults)) throw new PermanentError(`adapter "${name}" implements another adapter API version`);

		const wrapped = guarded(adapter, { ...guard, provider: name, faults });

		built.set(name, wrapped);

		return wrapped;
	};

	const resolved: Partial<Record<Slot, Adapter>> = {};

	for (const [slot, name] of names) resolved[slot] = await adapterNamed(name);

	return resolved;
};
