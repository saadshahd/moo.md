import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Adapter } from "../adapter-api.ts";
import type { Faults } from "../state/faults.ts";
import type { Card } from "../status/format.ts";
import { type GuardOptions, guarded } from "./guard.ts";
import { refuseOtherVersion } from "./registry.ts";

const ENGINE_IMPORT = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'](xstate|@statelyai\/agent)(?:\/[^"']*)?["']/;

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

/** V12: the files among `files` that import `xstate` or `@statelyai/agent`. */
export const engineImporters = (files: readonly string[]): { file: string; module: string }[] => {
	const found: { file: string; module: string }[] = [];

	for (const file of files) {
		const match = ENGINE_IMPORT.exec(readFileSync(file, "utf8"));

		if (match) found.push({ file, module: match[1] ?? "" });
	}

	return found;
};

/** Every source file under `dir`; empty when `dir` does not exist. */
export const sourceFiles = (dir: string): string[] => {
	try {
		return readdirSync(dir, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile() && SOURCE.test(entry.name) && !entry.parentPath.includes("node_modules"))
			.map((entry) => join(entry.parentPath, entry.name))
			.sort();
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];

		throw error;
	}
};

export type Admission = { readonly ok: true; readonly adapter: Adapter } | { readonly ok: false; readonly cards: Card[] };

export type AdmitInput = {
	readonly name: string;
	readonly adapter: Adapter;
	/** The adapter's own source files, for the V12 scan. */
	readonly files?: readonly string[];
	/** Paths in cards are shown relative to this folder. */
	readonly root?: string;
	readonly faults: Faults;
	readonly guard: Omit<GuardOptions, "provider" | "faults">;
};

/**
 * The start check for one adapter. It refuses an adapter, with one card, when:
 * - it implements another API version (V11);
 * - its source imports `xstate` or `@statelyai/agent` (V12);
 * - its replies no longer have the shape setup recorded (V7).
 * A refusal holds only that adapter; the caller runs the rest of hum.
 */
export const admit = async ({ name, adapter, files = [], root = process.cwd(), faults, guard }: AdmitInput): Promise<Admission> => {
	const cards: Card[] = [];

	if (refuseOtherVersion(name, adapter, faults)) cards.push(...faults.list().filter((card) => card.key === `adapter-api-mismatch:${name}`));

	for (const { file, module } of engineImporters(files)) {
		cards.push(
			faults.raise({
				code: "adapter-imports-engine",
				item: relative(root, file) || file,
				cause: `${relative(root, file) || file} imports "${module}", which an adapter may not.`,
				fix: "Import only the adapter API; keep the state machine out of the adapter.",
			}),
		);
	}

	if (cards.length > 0) return { ok: false, cards };

	const wrapped = guarded(adapter, { ...guard, provider: name, faults });

	try {
		const ready = await wrapped.workSource?.listReady();
		const first = ready?.[0];

		if (first) await wrapped.workSource?.read(first.id);
	} catch (error) {
		// The guard raised a card for a changed shape or a provider that stays down; any other failure gets one here.
		if (!faults.list().some((card) => card.item === name)) {
			faults.raise({
				code: "integration-probe-failed",
				item: name,
				cause: `The start check could not read ${name}: ${error instanceof Error ? error.message : String(error)}`.split("\n")[0] ?? "",
				fix: `Check ${name}'s setup with /hum.`,
			});
		}

		return { ok: false, cards: faults.list().filter((card) => card.item === name) };
	}

	return { ok: true, adapter: wrapped };
};
