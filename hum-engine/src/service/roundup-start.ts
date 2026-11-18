import { shellQuote } from "../exec.ts";

/** The columns and rows the Terminal opens with; `rup terminal spawn` requires both. */
const TERMINAL_SIZE = { cols: 120, rows: 40 } as const;

/** roundup gives a Terminal it starts for a program no Agent id, so the Agent that runs the start passes its own, as its shell expands it. */
const AGENT_ENV = `--env "{\\"ROUNDUP_AGENT_ID\\":\\"$ROUNDUP_AGENT_ID\\"}"`;

/**
 * The shell command an Agent runs to start `command` in a roundup Terminal in `repo`. Only such a Terminal holds
 * roundup's socket, whose path changes each time roundup starts, so no service unit can reach roundup.
 */
export const roundupStart = (repo: string, command: readonly string[]): string =>
	["rup terminal spawn", shellQuote(repo), TERMINAL_SIZE.cols, TERMINAL_SIZE.rows, ...command.map((word) => `--command ${shellQuote(word)}`), AGENT_ENV].join(" ");
