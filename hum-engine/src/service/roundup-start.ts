import { shellQuote } from "../exec.ts";

/** The columns and rows the Terminal opens with; `rup terminal spawn` requires both. */
const TERMINAL_SIZE = { cols: 120, rows: 40 } as const;

/** roundup starts a program's Terminal on its own PATH, which lacks rup, and with no Agent id, so the start passes both from the shell of the Agent that runs it. */
const SHELL_ENV = `--env "{\\"PATH\\":\\"$PATH\\",\\"ROUNDUP_AGENT_ID\\":\\"$ROUNDUP_AGENT_ID\\"}"`;

/**
 * The shell command an Agent runs to start `command` in a roundup Terminal in `repo`. Only such a Terminal holds
 * roundup's socket, whose path changes each time roundup starts, so no service unit can reach roundup.
 */
export const roundupStart = (repo: string, command: readonly string[]): string =>
	["rup terminal spawn", shellQuote(repo), TERMINAL_SIZE.cols, TERMINAL_SIZE.rows, ...command.map((word) => `--command ${shellQuote(word)}`), SHELL_ENV].join(" ");
