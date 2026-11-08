import type { UnitBuilder } from "./unit.ts";

type Sections = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** systemd reads `%` as the start of a specifier. */
const literalPercent = (text: string): string => text.replace(/%/g, "%%");

/** A word in a systemd line: quoted, with `%` and `$` doubled so no specifier or variable expands. */
const word = (text: string): string => `"${literalPercent(text).replace(/[\\"]/g, "\\$&").replace(/\$/g, "$$$$")}"`;

const assertOneLine = (values: readonly string[]): void => {
	for (const value of values) if (/[\n\r]/.test(value)) throw new Error(`a unit value holds a line break: ${JSON.stringify(value)}`);
};

/**
 * systemd reads `Key=value` lines whose quotes are its own. An INI library quotes a value that holds a quote
 * and so changes what systemd reads.
 */
const serialize = (sections: Sections): string =>
	`${Object.entries(sections)
		.map(([section, keys]) => `[${section}]\n${Object.entries(keys).map(([key, value]) => `${key}=${value}`).join("\n")}`)
		.join("\n\n")}\n`;

/** A user service that restarts after a failure only: the start script exits 0 when it gives up. */
export const systemdUnit: UnitBuilder = ({ repo, command, path, env, restartDelaySeconds }) => {
	const environment = { PATH: path, ...env };

	assertOneLine([repo, ...command, ...Object.values(environment)]);

	return serialize({
		Unit: { Description: `hum worker for ${literalPercent(repo)}`, After: "network-online.target", Wants: "network-online.target" },
		Service: {
			Type: "simple",
			WorkingDirectory: literalPercent(repo),
			Environment: Object.entries(environment)
				.map(([key, value]) => word(`${key}=${value}`))
				.join(" "),
			ExecStart: command.map(word).join(" "),
			Restart: "on-failure",
			RestartSec: String(restartDelaySeconds),
		},
		Install: { WantedBy: "default.target" },
	});
};
