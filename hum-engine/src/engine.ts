import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import { ADD_EXACT, type PinningManager } from "./setup/tables.ts";
import { orMissing } from "./state/fs.ts";

/** The engine's package name, as an owner's package.json pins it. */
export const ENGINE_NAME: string = pkg.name;

/**
 * The engine's folder in an owner's repo. npm and bun put the package there and pnpm a link to it, so the path holds
 * across versions, where the resolved real path under pnpm names one version's folder.
 */
export const installedEngine = (repo: string): string => join(repo, "node_modules", ENGINE_NAME);

/** The engine's CLI file in an owner's repo, as the package's `bin` names it. */
export const installedCli = (repo: string): string => join(installedEngine(repo), pkg.bin.hum);

/** A pin that is a folder or tarball on disk rather than a registry version; hum never moves one. */
export const LOCAL_PIN = /^(file|link):/;

const Manifest = z.looseObject({
	dependencies: z.record(z.string(), z.string()).default({}),
	devDependencies: z.record(z.string(), z.string()).default({}),
});

/** The engine a package.json's text pins, in either dependency field; none where it pins none or is no package.json. */
export const pinOf = (manifest: string): string | undefined => {
	const parsed = Manifest.safeParse(JSON.parse(manifest || "null"));

	return parsed.success ? { ...parsed.data.dependencies, ...parsed.data.devDependencies }[ENGINE_NAME] : undefined;
};

/** The engine the repo's package.json pins. */
export const pinIn = (repo: string): string | undefined => pinOf(orMissing(() => readFileSync(join(repo, "package.json"), "utf8"), ""));

/** The command that pins the engine at `version` with `manager`, or one per package manager where the repo names none. */
export const addEngineCommand = (manager: PinningManager | undefined, version: string): string =>
	(manager === undefined ? Object.values(ADD_EXACT) : [ADD_EXACT[manager]]).map((add) => `\`${add} ${ENGINE_NAME}@${version}\``).join(" or ");

/** What the owner does to run a newer engine, with the repo's package manager where it is known. */
export const updateEngineStep = (manager?: PinningManager): string => `Update the engine: hum updates itself on a Mac where engineUpdates is on, or run ${addEngineCommand(manager, "latest")}.`;
