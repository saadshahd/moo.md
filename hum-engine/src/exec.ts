import pTimeout from "p-timeout";
import { type Options, type Output, x } from "tinyexec";
import { type HumConfig, SHIPPED_DEFAULTS } from "./config/schema.ts";
import { SECOND_MS } from "./time.ts";

/** A process environment: the root reads `process.env` once and hands it down. */
export type Env = Readonly<Record<string, string | undefined>>;

/** The GitHub tokens hum pushes and calls GitHub with. A comment can steer a run, and a run writes the code the checks run, so neither holds one. */
const GITHUB_TOKENS = ["GH_TOKEN", "GITHUB_TOKEN"] as const;

/**
 * The environment as a run and the repo's checks get it: everything but the GitHub tokens, which only hum itself uses.
 * tinyexec starts every child from `process.env` and lays this over it, so a token is kept out by naming it with no
 * value, which the runtime drops; leaving the name out would let `process.env` put it back.
 */
export const withoutGitHubTokens = (env: Env) => ({ ...env, ...Object.fromEntries(GITHUB_TOKENS.map((name) => [name, undefined])) });

/** A command ran past its limit and was told to stop. */
export class CommandTimedOut extends Error {
	override name = "CommandTimedOut";

	constructor(
		readonly command: string,
		readonly args: readonly string[],
		readonly timeoutMs: number,
	) {
		super(`\`${[command, ...args].join(" ")}\` ran longer than ${timeoutMs / SECOND_MS} seconds and was stopped`);
	}
}

/** The owner's `commandTimeoutSeconds` in milliseconds. */
export const commandTimeoutMs = ({ commandTimeoutSeconds }: Pick<HumConfig, "commandTimeoutSeconds">): number => commandTimeoutSeconds * SECOND_MS;

/** The limit where no `hum.json` is read yet. */
export const SHIPPED_COMMAND_TIMEOUT_MS = commandTimeoutMs(SHIPPED_DEFAULTS);

/** How long a command's processes get to end after the stop signal before they are killed. */
const STOP_GRACE_MS = 2000;
const POLL_MS = 50;

export type ExecOptions = Partial<Omit<Options, "timeout" | "signal" | "persist">> & {
	readonly timeoutMs: number;
	readonly graceMs?: number;
};

/**
 * Signals every process in the group, and answers false once none is left to signal. macOS answers EPERM, not ESRCH,
 * while the group holds only processes that have exited and wait to be reaped, as the command itself does until Bun
 * reaps it.
 */
const signalGroup = (group: number, signal: "SIGTERM" | "SIGKILL" | 0): boolean => {
	try {
		return process.kill(-group, signal);
	} catch (error) {
		if (error instanceof Error && "code" in error && (error.code === "ESRCH" || error.code === "EPERM")) return false;

		throw error;
	}
};

const isGone = async (group: number, graceMs: number): Promise<boolean> => {
	for (let waited = 0; waited < graceMs && signalGroup(group, 0); waited += POLL_MS) await Bun.sleep(POLL_MS);

	return !signalGroup(group, 0);
};

/** Ends every process the command started: SIGTERM first, so git removes its lock files, then SIGKILL for what ignores it. */
const stopGroup = async (group: number, graceMs: number): Promise<void> => {
	signalGroup(group, "SIGTERM");

	if (await isGone(group, graceMs)) return;

	signalGroup(group, "SIGKILL");
	await isGone(group, graceMs);
};

/**
 * Runs a command and returns what it printed. The call ends at `timeoutMs` whatever the child does: tinyexec's own
 * `timeout` still waits for the child to exit and close its pipes, which a child that ignores the stop signal, a
 * grandchild that holds a pipe, or an exit the runtime never reports does not allow. The command runs as its own
 * process group, and a timeout ends the whole group, so the helpers git and ssh start do not outlive it. A timeout
 * throws `CommandTimedOut`, never a result.
 */
export const exec = (command: string, args: readonly string[], { timeoutMs, graceMs = STOP_GRACE_MS, ...options }: ExecOptions): Promise<Output> => {
	const child = x(command, [...args], { ...options, persist: true });

	return pTimeout(child, {
		milliseconds: timeoutMs,
		fallback: async () => {
			if (child.pid !== undefined) await stopGroup(child.pid, graceMs);

			throw new CommandTimedOut(command, args, timeoutMs);
		},
	});
};
