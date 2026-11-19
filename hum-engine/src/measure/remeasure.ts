import { join } from "node:path";
import type { Boundary } from "../config/schema.ts";
import { spawn } from "../exec.ts";

const EVAL_SCRIPT = join(import.meta.dir, "..", "..", "scripts", "eval.ts");

/** The folder of each boundary's labelled set and results: in the package, and in an owner's `.hum/` for the results of their own models. */
export const EVALS_DIR = "evals";

const OUTPUT_TAIL = 300;

/** A model to measure on the owner's judges, at the boundaries named, or at every one hum ships a set for when none are. */
export type Measurement = { readonly model: string; readonly runs: number; readonly boundaries?: readonly Boundary[] };

/** Whether a measurement recorded a rate at every boundary it was asked for, and the end of what it printed when it did not. */
export type Measured = { readonly ok: true } | { readonly ok: false; readonly why: string };

/**
 * Measures a model on the judges of the config in `repo`'s `.hum/`, through `scripts/eval.ts`, which records each
 * pooled rate with its judge's hash in `.hum/hum.json` once it is done. `inherit` shows its progress on this
 * process's terminal; otherwise its output is kept to say why it failed.
 */
export const measureOn = async (repo: string, { model, runs, boundaries = [] }: Measurement, { inherit, signal }: { readonly inherit: boolean; readonly signal?: AbortSignal }): Promise<Measured> => {
	const ran = await spawn(process.execPath, [EVAL_SCRIPT, "--model", model, "--runs", String(runs), "--write", join(repo, ".hum"), ...boundaries], {
		throwOnError: false,
		signal,
		nodeOptions: { cwd: repo, stdio: inherit ? "inherit" : "pipe" },
	});

	return ran.exitCode === 0 ? { ok: true } : { ok: false, why: `${ran.stderr.trim() || ran.stdout.trim() || `it exited ${ran.exitCode ?? "on a signal"}`}`.slice(-OUTPUT_TAIL) };
};
