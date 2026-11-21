import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };

/**
 * The engine's folder in an owner's repo. npm and bun put the package there and pnpm a link to it, so the path holds
 * across versions, where the resolved real path under pnpm names one version's folder.
 */
export const installedEngine = (repo: string): string => join(repo, "node_modules", pkg.name);

/** The engine's CLI file in an owner's repo, as the package's `bin` names it. */
export const installedCli = (repo: string): string => join(installedEngine(repo), pkg.bin.hum);
