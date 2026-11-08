import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { rawConfig, root } from "./config.ts";
import { makeShim, type ShimSpec } from "./shim.ts";
import { itemFile, sh, WorkRepo } from "./work-repo.ts";

export const MAIN = join(root, "src", "cli", "main.ts");

/**
 * An owner's checkout set up for the `hum` binary: the shipped config written under `.hum/`, a bare remote as
 * `origin`, a stand-in `claude` first on PATH, and hope's folder named. Nothing leaves the temp folders.
 */
export const ownerRepo = (spec: ShimSpec, env: Record<string, string> = {}, edit: Parameters<typeof rawConfig>[0] = () => {}) => {
	const repo = new WorkRepo();
	const shim = makeShim(spec);
	const raw = rawConfig(edit);

	writeFileSync(join(repo.owner, ".hum", "hum.json"), JSON.stringify(raw.hum));

	for (const [name, kind] of Object.entries<object>(raw.kinds)) {
		mkdirSync(join(repo.owner, ".hum", "kinds"), { recursive: true });
		writeFileSync(join(repo.owner, ".hum", "kinds", `${name}.json`), JSON.stringify(kind));
	}

	for (const [path, text] of Object.entries<string>(raw.roles)) {
		mkdirSync(dirname(join(repo.owner, ".hum", path)), { recursive: true });
		writeFileSync(join(repo.owner, ".hum", path), text);
	}

	repo.commit("config");
	sh(repo.owner, ["push", "-q", "origin", "main"]);

	const home = mkdtempSync(join(tmpdir(), "hum-home-"));

	return {
		repo,
		shim,
		home,
		item: (id: string) => repo.add(id, itemFile(id, "ready", "Do the work.")),
		/** The environment a unit or workflow gives the binary. */
		env: {
			...shim.env,
			PATH: `${dirname(shim.binary)}:${process.env.PATH}`,
			HOME: home,
			HUM_HOPE_ROOT: join(root, "..", "hope"),
			HUM_KIND: "docs",
			HUM_CHECKS: JSON.stringify(["true"]),
			...env,
		},
	};
};
