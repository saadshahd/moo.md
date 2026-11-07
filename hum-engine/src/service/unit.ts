import { readFileSync } from "node:fs";
import { join } from "node:path";

/** What a unit needs to run `hum serve` on its own: every path absolute, because a unit starts with a bare PATH. */
export type UnitVars = {
	/** The launchd label; the systemd unit has none. */
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

const TEMPLATES = join(import.meta.dir, "..", "..", "templates");

const FILES: Record<UnitKind, string> = { launchd: "launchd/md.moo.hum.plist", systemd: "systemd/hum.service" };

const xml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** systemd reads a line of words; a word with a space, quote or `%` is quoted, and `%` and `$` are doubled. */
const word = (text: string): string => `"${text.replace(/[\\"]/g, "\\$&").replace(/%/g, "%%").replace(/\$/g, "$$$$")}"`;

/** Fills `{{key}}`. A placeholder that stands for whole elements sits in an XML comment, so the template still lints; the comment goes with it. */
const fill = (template: string, values: Readonly<Record<string, string>>): string =>
	template.replace(/<!-- \{\{(\w+)\}\} -->|\{\{(\w+)\}\}/g, (_, wrapped: string | undefined, bare: string | undefined) => {
		const key = wrapped ?? bare ?? "";
		const value = values[key];

		if (value === undefined) throw new Error(`the unit template names {{${key}}} and no value was given`);

		return value;
	});

/** Renders the unit file of one service manager from its template in `templates/`. Throws when a value would break the file. */
export const renderUnit = (kind: UnitKind, vars: UnitVars): string => {
	const env = { PATH: vars.path, ...vars.env };
	const template = readFileSync(join(TEMPLATES, FILES[kind]), "utf8");

	for (const value of [vars.label, vars.repo, vars.log, ...vars.command, ...Object.values(env)]) {
		if (/[\n\r]/.test(value)) throw new Error(`a unit value holds a line break: ${JSON.stringify(value)}`);
	}

	return kind === "launchd"
		? fill(template, {
				label: xml(vars.label),
				repo: xml(vars.repo),
				log: xml(vars.log),
				arguments: vars.command.map((arg) => `\t\t<string>${xml(arg)}</string>`).join("\n"),
				environment: Object.entries(env).map(([key, value]) => `\t\t<key>${xml(key)}</key>\n\t\t<string>${xml(value)}</string>`).join("\n"),
			})
		: fill(template, {
				repo: vars.repo.replace(/%/g, "%%"),
				command: vars.command.map(word).join(" "),
				environment: Object.entries(env).map(([key, value]) => `Environment=${word(`${key}=${value}`)}`).join("\n"),
			});
};
