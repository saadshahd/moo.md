import { launchdUnit } from "./launchd.ts";
import { systemdUnit } from "./systemd.ts";

/** What a unit needs to run `hum serve` on its own: every path absolute, because a unit starts with a bare PATH. */
export type UnitVars = {
	/** The launchd label, which also names the unit's file. */
	readonly label: string;
	/** The owner's checkout. */
	readonly repo: string;
	/** The program and its arguments: the runtime, the `hum` entry, `serve`, then the worker's options. */
	readonly command: readonly string[];
	/** The unit's PATH; it must reach `git`, `claude` and the runtime. */
	readonly path: string;
	/** More environment, such as `HOME`. */
	readonly env?: Readonly<Record<string, string>>;
	/** Where launchd writes the output. */
	readonly log: string;
};

export type UnitKind = "launchd" | "systemd";

/** The seconds a service manager waits before it starts a failed script again. */
const RESTART_DELAY_SECONDS = 10;

export type UnitBuilder = (vars: UnitVars, restartDelaySeconds: number) => string;

const UNITS = { launchd: launchdUnit, systemd: systemdUnit } as const satisfies Record<UnitKind, UnitBuilder>;

/** The unit file of one service manager. Throws when a value would break the file. */
export const renderUnit = (kind: UnitKind, vars: UnitVars): string => UNITS[kind](vars, RESTART_DELAY_SECONDS);
