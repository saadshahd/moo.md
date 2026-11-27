import type { On } from "claude-code";
import { type Engine, mock } from "claude-code/testing";
import type { Status } from "../../hum-engine/src/status/format.ts";
import { NOW } from "./status.ts";

const COLUMNS = 45;
const ROWS = 24;
const REPO = "/repo";
export const CONFIG = `${REPO}/.hum/hum.json`;
export const ENGINE = `${REPO}/node_modules/.bin/hum`;
const GIT_PLACES = `${REPO}\n${REPO}/.git\n`;
const STATUS_PATH = `${REPO}/.git/hum/status.json`;
const DISMISSED_PATH = `${REPO}/.git/hum/pane-dismissed.json`;

export const PANE = { plugin: "hum", component: "Pane", requestId: "hum", props: { title: "hum", isFocused: false, bodyColumns: COLUMNS, placement: "inline", scroll: { offset: 0, bodyRows: ROWS }, view: {} } } as const;
export const BAND = { plugin: "hum", component: "AbovePrompt", props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 5, bodyColumns: COLUMNS, scroll: { offset: 0, bodyRows: 5 }, view: {} } } as const;

/** A file on the test's disk: its text and its file time. */
type Held = { readonly text: string; readonly modified: number };

/** The folder the session starts in: whether git finds a repo there, the hum files it holds, the status file hum's worker wrote, and the pane's dismissals beside it. */
export type Disk = { isRepo: boolean; humFiles: readonly string[]; status: string | undefined; modified: number; dismissed?: Held };

const ran = (exitCode: number, stdout: string) => ({ exitCode, stdout, stderr: "", isStdoutTruncated: false, isStderrTruncated: false });

/** What the engine does when the mod runs the repo's hum. */
type Hum = (argv: readonly string[]) => Promise<void> | void;

const heldAt = (disk: Disk, path: string): Held | undefined => {
	if (path === DISMISSED_PATH) return disk.dismissed;

	return path === STATUS_PATH && disk.status !== undefined ? { text: disk.status, modified: disk.modified } : undefined;
};

/** The engine beneath the plugin: the session's environment, git, a disk the test changes where the mod may write only its dismissals, the repo's hum, and the clock that moves it on. */
export const engineWith = (on: On, disk: Disk, hum: Hum = () => undefined, env: Readonly<Record<string, string>> = {}) => {
	const clock = mock.clock(on, { now: NOW });

	on("env.get", (_, e) => ({ value: env[e.name] }));
	on("process.run", async (_, e) => {
		if (e.argv[0] === "git") return { value: disk.isRepo ? ran(0, GIT_PLACES) : ran(128, "") };

		await hum(e.argv);

		return { value: ran(0, "") };
	});
	on("session.start", (_, e) => ({ cwd: e.cwd }));
	on("fs.exists", (_, e) => ({ value: disk.humFiles.includes(e.path) }));
	on("fs.stat", (_, e) => {
		const held = heldAt(disk, e.path);

		return held === undefined ? { deny: "ENOENT" } : { value: { kind: "file", size: held.text.length, mtimeMs: held.modified, isLink: false } };
	});
	on("fs.read", (_, e) => {
		const held = heldAt(disk, e.path);

		return held === undefined ? { deny: "ENOENT" } : { value: held.text };
	});
	on("fs.write", (_, e) => {
		if (e.path !== DISMISSED_PATH) return { deny: `the mod wrote ${e.path}` };

		disk.dismissed = { text: e.text, modified: (disk.dismissed?.modified ?? 0) + 1 };

		return { value: undefined };
	});
	on("ui.render", ($, e) => {
		const { Text } = $.ui.resolve(e);

		return <Text>other plugin's band</Text>;
	});

	return clock;
};

export const start = async ($: Engine): Promise<void> => {
	await $.session.start({ cwd: REPO, surface: "terminal", isInteractive: true });
};

export const served = (status: Status): Disk => ({ isRepo: true, humFiles: [CONFIG, ENGINE], status: JSON.stringify(status), modified: 1 });

