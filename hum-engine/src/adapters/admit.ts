import { existsSync, readFileSync } from "node:fs";
import { extname, relative } from "node:path";
import type { Adapter } from "../adapter-api.ts";
import type { Faults } from "../state/faults.ts";
import type { Card } from "../status/format.ts";
import { type GuardOptions, guarded } from "./guard.ts";
import { refuseOtherVersion } from "./registry.ts";

/** Modules an adapter may not import: the state machine stays inside the engine. */
const ENGINE_MODULES = ["xstate", "@statelyai/agent"] as const;

const SOURCE_GLOB = new Bun.Glob("**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}");

/** The parser for each source extension. */
const LOADERS = {
	".ts": "ts",
	".mts": "ts",
	".cts": "ts",
	".tsx": "tsx",
	".js": "js",
	".mjs": "js",
	".cjs": "js",
	".jsx": "jsx",
} as const satisfies Record<string, "ts" | "tsx" | "js" | "jsx">;

const isLoaderExtension = (extension: string): extension is keyof typeof LOADERS => extension in LOADERS;

const engineModuleOf = (path: string): string | undefined => ENGINE_MODULES.find((module) => path === module || path.startsWith(`${module}/`));

const isOutsideDependencies = (path: string): boolean => !path.split("/").includes("node_modules");

/** The files among `files` that import an engine module, with the module each imports. */
export const engineImporters = (files: readonly string[]): { file: string; module: string }[] =>
	files.flatMap((file) => {
		const extension = extname(file);
		const loader = isLoaderExtension(extension) ? LOADERS[extension] : "ts";

		const module = new Bun.Transpiler({ loader })
			.scanImports(readFileSync(file, "utf8"))
			.map((imported) => engineModuleOf(imported.path))
			.find((found) => found !== undefined);

		return module ? [{ file, module }] : [];
	});

/** Every source file under `dir`, sorted; none when `dir` does not exist. */
export const sourceFiles = (dir: string): string[] =>
	existsSync(dir) ? [...SOURCE_GLOB.scanSync({ cwd: dir, absolute: true })].filter(isOutsideDependencies).sort() : [];

export type Admission = { readonly ok: true; readonly adapter: Adapter } | { readonly ok: false; readonly cards: Card[] };

export type AdmitInput = {
	readonly name: string;
	readonly adapter: Adapter;
	/** The adapter's own source files, scanned for engine imports. */
	readonly files?: readonly string[];
	/** Paths in cards are shown relative to this folder. */
	readonly root?: string;
	readonly faults: Faults;
	readonly guard: Omit<GuardOptions, "provider" | "faults">;
};

/**
 * The start check for one adapter. It refuses an adapter, with one card, when it implements another API version,
 * when its source imports an engine module, or when its replies no longer have the shape the API defines.
 * A refusal holds only that adapter; the caller runs the rest of hum.
 */
export const admit = async ({ name, adapter, files = [], root = process.cwd(), faults, guard }: AdmitInput): Promise<Admission> => {
	const shown = (file: string) => relative(root, file) || file;
	const versionCard = refuseOtherVersion(name, adapter, faults);

	const importCards = engineImporters(files).map(({ file, module }) =>
		faults.raise({
			code: "adapter-imports-engine",
			item: shown(file),
			cause: `${shown(file)} imports "${module}", which an adapter may not.`,
			fix: "Import only the adapter API; keep the state machine out of the adapter.",
		}),
	);

	const refusals = [...(versionCard ? [versionCard] : []), ...importCards];

	if (refusals.length > 0) return { ok: false, cards: refusals };

	const wrapped = guarded(adapter, { ...guard, provider: name, faults });

	try {
		const [first] = (await wrapped.workSource?.listReady()) ?? [];

		if (first) await wrapped.workSource?.read(first.id);
	} catch (error) {
		const raised = faults.list().filter((card) => card.item === name);

		return {
			ok: false,
			cards:
				raised.length > 0
					? raised
					: [
							faults.raise({
								code: "integration-probe-failed",
								item: name,
								cause: `The start check could not read ${name}: ${error instanceof Error ? error.message : String(error)}`.split("\n")[0] ?? "",
								fix: `Check ${name}'s setup with /hum.`,
							}),
						],
		};
	}

	return { ok: true, adapter: wrapped };
};
