import { appendFileSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { installedEngine } from "../../src/engine.ts";
import { rawConfig, root, writeConfigDir } from "./config.ts";
import { makeShim, type ShimSpec } from "./shim.ts";
import { itemFile, sh, WorkRepo } from "./work-repo.ts";
import { tempDir } from "./temp.ts";

export const MAIN = join(root, "src", "cli", "main.ts");

/** Installs `engine` in `repo` as pnpm does: a link in node_modules, which git leaves out. */
export const installEngine = (repo: string, engine = root): void => {
	mkdirSync(dirname(installedEngine(repo)), { recursive: true });
	symlinkSync(engine, installedEngine(repo));
	appendFileSync(join(repo, ".git", "info", "exclude"), "node_modules/\n");
};

/**
 * An owner's checkout set up for the `hum` binary: the shipped config written under `.hum/`, a bare remote as
 * `origin`, a stand-in `claude` first on PATH, and hope's folder named. Nothing leaves the temp folders.
 */
export const ownerRepo = (spec: ShimSpec, env: Record<string, string> = {}, edit: Parameters<typeof rawConfig>[0] = () => {}) => {
	const repo = new WorkRepo();
	const shim = makeShim(spec);

	writeConfigDir(join(repo.owner, ".hum"), rawConfig(edit));

	repo.commit("config");
	sh(repo.owner, ["push", "-q", "origin", "main"]);

	const home = tempDir("home");

	return {
		repo,
		shim,
		home,
		item: (id: string) => repo.add(id, itemFile(id, { state: "ready", body: "Do the work." })),
		/** The environment a unit or workflow gives the binary. */
		env: {
			...shim.env,
			PATH: `${dirname(shim.binary)}:${process.env.PATH}`,
			HOME: home,
			HUM_HOPE_ROOT: join(root, "..", "hope"),
			...env,
		},
	};
};
