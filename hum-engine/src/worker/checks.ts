import type { HumConfig } from "../config/schema.ts";
import { CommandTimedOut, exec } from "../exec.ts";
import { SECOND_MS } from "../time.ts";

export type ShellOptions = {
	/** Added to the worker's own environment. */
	readonly env?: Readonly<Record<string, string>>;
	/** A command still running after this many ms is stopped, with every process it started, and counts as failed. */
	readonly timeoutMs: number;
};

/**
 * One check's failure as its command, exit code and output, or as the limit it ran past; undefined when it passes.
 * It runs with no stdin and the worker's own PATH, as in the owner's shell; the clone's `node_modules/.bin` is not added.
 */
const failureOf = async (command: string, cwd: string, { env, timeoutMs }: ShellOptions): Promise<string | undefined> => {
	try {
		const { exitCode, stdout, stderr } = await exec("sh", ["-c", command], { nodePath: false, timeoutMs, nodeOptions: { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] } });

		return exitCode === 0 ? undefined : `${command} exited ${exitCode}:\n${stdout}${stderr}`;
	} catch (error) {
		if (error instanceof CommandTimedOut) return error.message;

		throw error;
	}
};

/** How long the repo's checks may run: the owner's `proofTimeoutSeconds` in milliseconds. */
export const checksTimeoutMs = ({ proofTimeoutSeconds }: Pick<HumConfig, "proofTimeoutSeconds">): number => proofTimeoutSeconds * SECOND_MS;

/** The first failing check; undefined when all pass. */
export const runChecks = async (commands: readonly string[], cwd: string, options: ShellOptions): Promise<string | undefined> => {
	for (const command of commands) {
		const failure = await failureOf(command, cwd, options);

		if (failure !== undefined) return failure;
	}

	return undefined;
};
