#!/usr/bin/env bun
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as core from "@actions/core";
import { z } from "zod";
import { x } from "tinyexec";
import pkg from "../../package.json" with { type: "json" };
import { type Baseline, checkBump, type Verdict } from "./compare.ts";
import { extractSurface, Surface } from "./surface.ts";

export const SURFACE_FILE = "surface.json";

const PACKAGE_ROOT = resolve(import.meta.dir, "../..");

/** The registry answers this on stderr for a package or version it does not hold. */
const NOT_FOUND = "E404";

const PackResult = z.tuple([z.object({ filename: z.string() })]);

const SURFACE_IN_TARBALL = `package/${SURFACE_FILE}`;

const npm = async (...args: string[]) => {
	const result = await x("npm", args, { nodeOptions: { cwd: PACKAGE_ROOT } });

	return { ok: result.exitCode === 0, stdout: result.stdout.trim(), stderr: result.stderr };
};

/** The version the registry holds for a package spec, or nothing when the registry has none. */
const registryVersion = async (spec: string): Promise<string | undefined> => {
	const view = await npm("view", spec, "version");

	if (view.ok) return view.stdout || undefined;

	if (view.stderr.includes(NOT_FOUND)) return undefined;

	throw new Error(`npm view ${spec} failed: ${view.stderr}`);
};

const publishedSurface = async (version: string): Promise<Surface | undefined> => {
	const folder = await mkdtemp(join(tmpdir(), "hum-release-"));
	const packed = await npm("pack", `${pkg.name}@${version}`, "--pack-destination", folder, "--json");

	if (!packed.ok) throw new Error(`npm pack ${pkg.name}@${version} failed: ${packed.stderr}`);

	const [{ filename }] = PackResult.parse(JSON.parse(packed.stdout));
	const files = await new Bun.Archive(await Bun.file(join(folder, filename)).bytes()).files();

	return files.get(SURFACE_IN_TARBALL)?.text().then((text) => Surface.parse(JSON.parse(text)));
};

const baselineOf = async (): Promise<Baseline | undefined> => {
	const version = await registryVersion(pkg.name);

	return version === undefined ? undefined : { version, surface: await publishedSurface(version) };
};

/** Writes the surface into the package folder, where `files` ships it with the package. */
const writeSurface = async (): Promise<number> => {
	await Bun.write(join(PACKAGE_ROOT, SURFACE_FILE), `${JSON.stringify(await extractSurface(), null, "\t")}\n`);

	return 0;
};

const report = (verdict: Verdict): void => {
	if (verdict.ok) return core.info(verdict.summary);

	for (const reason of verdict.reasons) core.error(reason);

	core.setFailed("the version bump is too small for the change");
};

/** Says through the `publish` output (and the `version` output) whether this version still has to go out, and refuses a bump too small for its change. */
const check = async (): Promise<number> => {
	core.setOutput("version", pkg.version);

	if ((await registryVersion(`${pkg.name}@${pkg.version}`)) !== undefined) {
		core.info(`${pkg.name}@${pkg.version} is already on npm; nothing to release`);
		core.setOutput("publish", false);

		return 0;
	}

	const verdict = checkBump(await baselineOf(), { version: pkg.version, surface: await extractSurface() });

	report(verdict);
	core.setOutput("publish", verdict.ok);

	return verdict.ok ? 0 : 1;
};

const CommandName = z.enum(["surface", "check"], { error: "usage: release <surface | check>" });

const COMMANDS: Record<z.infer<typeof CommandName>, () => Promise<number>> = { surface: writeSurface, check };

process.exitCode = await COMMANDS[CommandName.parse(process.argv[2])]();
