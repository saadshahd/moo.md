import { execFile } from "node:child_process";
import { z } from "zod";
import { PermanentError } from "../adapter-api.ts";

export type GitResult = { readonly code: number; readonly stdout: string; readonly stderr: string };

export type GitOptions = { readonly cwd: string; readonly env?: Record<string, string>; readonly input?: string };

/** Runs `git`. A non-zero exit is a result, not a throw. */
export type Git = (args: readonly string[], options: GitOptions) => Promise<GitResult>;

export const runGit: Git = (args, { cwd, env, input }) =>
	new Promise((resolve, reject) => {
		const child = execFile(
			"git",
			[...args],
			{ cwd, env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 },
			(error, stdout, stderr) => {
				const code = error ? z.int().safeParse(error.code) : { success: true as const, data: 0 };

				if (!code.success) return reject(error);

				resolve({ code: code.data, stdout, stderr });
			},
		);

		child.stdin?.end(input ?? "");
	});

/** C1: no hook runs. `core.hooksPath` points nowhere, and `--no-verify` skips pre-push. */
export const HOOKS_OFF: readonly string[] = ["-c", "core.hooksPath=/dev/null"];

/** The git arguments for a push with hooks off. */
export const pushArgs = (rest: readonly string[]): string[] => [...HOOKS_OFF, "push", "--no-verify", ...rest];

/** The remote refused the push: a protected branch, a hook, a permission. Retrying cannot help. */
export class PushRefused extends PermanentError {
	override name = "PushRefused";
}

export type PushOutcome = "pushed" | "conflict";

const CONFLICT = /non-fast-forward|fetch first|already exists|stale info|failed to update ref|cannot lock ref/i;
const REFUSED = /remote rejected|declined|protected|GH006|denied|not permitted/i;

/**
 * Pushes with hooks off. `conflict` means another writer moved the ref first and a retry can win.
 * A refusal throws `PushRefused` with the remote's own words, and so does any other failure: nothing is swallowed.
 */
export const pushHooksOff = async (git: Git, cwd: string, rest: readonly string[]): Promise<PushOutcome> => {
	const result = await git(pushArgs(rest), { cwd });

	if (result.code === 0) return "pushed";

	const said = `${result.stderr}${result.stdout}`.trim();

	if (CONFLICT.test(said)) return "conflict";

	if (REFUSED.test(said)) throw new PushRefused(`git push refused: ${said}`);

	throw new PermanentError(`git push failed (exit ${result.code}): ${said}`);
};
