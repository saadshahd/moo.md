import type { HumConfig } from "../config/schema.ts";
import { CommandTimedOut, exec, withoutGitHubTokens } from "../exec.ts";
import { SECOND_MS } from "../time.ts";

export type ShellOptions = {
	/** Added to the worker's own environment. */
	readonly env?: Readonly<Record<string, string>>;
	/** A command still running after this many ms is stopped, with every process it started, and counts as failed. */
	readonly timeoutMs: number;
	/** Times a failing command runs again before its failure counts; a pass on any run counts as a pass. */
	readonly reruns?: number;
};

/**
 * One check's failure as its command, exit code and output, or as the limit it ran past; undefined when it passes.
 * It runs with no stdin and the worker's own PATH, as in the owner's shell; the clone's `node_modules/.bin` is not added.
 * A run wrote the code a check runs, so a check holds no GitHub token.
 */
const failureOf = async (command: string, cwd: string, { env, timeoutMs }: ShellOptions): Promise<string | undefined> => {
	try {
		const { exitCode, stdout, stderr } = await exec("sh", ["-c", command], { nodePath: false, timeoutMs, nodeOptions: { cwd, env: withoutGitHubTokens({ ...process.env, ...env }), stdio: ["ignore", "pipe", "pipe"] } });

		return exitCode === 0 ? undefined : `${command} exited ${exitCode}:\n${stdout}${stderr}`;
	} catch (error) {
		if (error instanceof CommandTimedOut) return error.message;

		throw error;
	}
};

/** A check's failure once its run and each of its reruns failed; undefined once any of them passes. */
const settledFailureOf = async (command: string, cwd: string, options: ShellOptions, reruns = options.reruns ?? 0): Promise<string | undefined> => {
	const failure = await failureOf(command, cwd, options);

	return failure === undefined || reruns === 0 ? failure : settledFailureOf(command, cwd, options, reruns - 1);
};

/** How the repo's checks run: stopped past the owner's `proofTimeoutSeconds`, and run again `checkReruns` times before a failure counts. */
export const checkLimits = ({ proofTimeoutSeconds, checkReruns }: Pick<HumConfig, "proofTimeoutSeconds" | "checkReruns">): Required<Pick<ShellOptions, "timeoutMs" | "reruns">> => ({
	timeoutMs: proofTimeoutSeconds * SECOND_MS,
	reruns: checkReruns,
});

/** A check that failed: its command, and the failure it gave. */
type CheckFailure = { readonly command: string; readonly failure: string };

/** The first failing check; undefined when all pass. */
export const firstFailing = async (commands: readonly string[], cwd: string, options: ShellOptions): Promise<CheckFailure | undefined> => {
	for (const command of commands) {
		const failure = await settledFailureOf(command, cwd, options);

		if (failure !== undefined) return { command, failure };
	}

	return undefined;
};

/** The first failing check's failure; undefined when all pass. */
export const runChecks = async (commands: readonly string[], cwd: string, options: ShellOptions): Promise<string | undefined> => (await firstFailing(commands, cwd, options))?.failure;
