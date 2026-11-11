import type { On } from "claude-code";
import { type Engine, expect, mock, test } from "claude-code/testing";
import type { Status } from "../../hum-engine/src/status/format.ts";
import { NOW, fullStatus } from "../fixtures/status.ts";
import { openingRows } from "./view/pane.ts";

const COLUMNS = 45;
const ROWS = 24;
const REPO = "/repo";

const PANE = { plugin: "hum", component: "Pane", requestId: "hum", props: { title: "hum", isFocused: false, bodyColumns: COLUMNS, placement: "inline", scroll: { offset: 0, bodyRows: ROWS }, view: {} } } as const;
const BAND = { plugin: "hum", component: "AbovePrompt", props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: COLUMNS, scroll: { offset: 0, bodyRows: 5 }, view: {} } } as const;

type Disk = { status: string | undefined; modified: number };

/** The engine beneath the plugin: a git repo at /repo, and a disk the test changes. */
const engineWith = (on: On, disk: Disk): void => {
	mock.clock(on, { now: NOW });
	on("process.run", () => ({ value: { exitCode: 0, stdout: `${REPO}/.git\n`, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } }));
	on("session.start", (_, e) => ({ cwd: e.cwd }));
	on("fs.stat", () => (disk.status === undefined ? { deny: "ENOENT" } : { value: { kind: "file", size: disk.status.length, mtimeMs: disk.modified, isLink: false } }));
	on("fs.read", () => ({ value: disk.status ?? "" }));
	on("ui.render", ($, e) => {
		const { Text } = $.ui.resolve(e);

		return <Text>other plugin's band</Text>;
	});
};

const start = async ($: Engine): Promise<void> => {
	await $.session.start({ cwd: REPO, surface: "terminal", isInteractive: true });
};

const written = (status: Status): Disk => ({ status: JSON.stringify(status), modified: 1 });

test("the pane at 45 by 24 shows the header and the first card whole", async ($, on) => {
	engineWith(on, written(fullStatus));
	await start($);

	const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

	expect(await ui.find({ type: "Text", text: /^Mac 40 s ago/ })).toBeDefined();
	expect(await ui.find({ type: "Text", text: /Which title should the release note carry\?/ })).toBeDefined();
	await ui.unmount();
});

test("the band is drawn above another plugin's band and carries the status and the control", async ($, on) => {
	engineWith(on, written(fullStatus));
	await start($);

	const ui = await $.ui.mount({ ...BAND, surface: "terminal" });

	expect(await ui.find({ type: "Text", text: /2 need you/ })).toBeDefined();
	expect(await ui.find({ type: "Text", text: /other plugin's band/ })).toBeDefined();
	await ui.unmount();
});

test("a status file that is not there yet reads as missing, not unreadable", async ($, on) => {
	engineWith(on, { status: undefined, modified: 0 });
	await start($);

	const ui = await $.ui.mount({ ...BAND, surface: "terminal" });

	expect(await ui.find({ type: "Text", text: /no status yet/ })).toBeDefined();
	await ui.unmount();
});

const NARROW = 44;
const INLINE_BODY = 40;

test("the band's open control asks for the rows the first card needs at the inline pane's own width, four cells under the band's", async ($, on) => {
	const asked: (number | undefined)[] = [];

	engineWith(on, written(fullStatus));
	on("ui.open", (_, e) => {
		asked.push(e.rows);

		return { value: { isPlaced: true } };
	});
	await start($);

	const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: NARROW }, surface: "terminal" });
	const control = await ui.find({ type: "Button", text: /open/ });

	await ui.press({ key: control?.key ?? "" });

	const read = { kind: "status", status: fullStatus } as const;
	const bandRows = openingRows(read, NOW, 300, NARROW);

	expect(asked).toEqual([openingRows(read, NOW, 300, INLINE_BODY)]);
	expect(asked).not.toEqual([bandRows]);
	await ui.unmount();
});

test("every card's main action is drawn filled between two caps in the accent colour", async ($, on) => {
	engineWith(on, written(fullStatus));
	await start($);

	const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
	const caps = await ui.findAll({ type: "Text", text: /^[▐▌]$/ });
	const filled = (await ui.findAll({ type: "Text" })).filter(({ props }) => props.backgroundColor !== undefined);

	expect(filled.length).toBeGreaterThan(0);
	expect(caps.map(({ props }) => props.color)).toEqual(filled.flatMap(() => ["suggestion", "suggestion"]));
	expect(new Set(filled.map(({ props }) => `${props.backgroundColor} ${props.color}`))).toEqual(new Set(["suggestion inverseText"]));
	await ui.unmount();
});

const HOUR_MS = 3_600_000;
const FIVE_MINUTES_MS = 300_000;

test("a hum watch that does not answer is not started again while it runs", async ($, on) => {
	const clock = mock.clock(on, { now: NOW });
	let started = 0;

	on("process.run", async (_, e) => {
		const isWatch = e.argv.at(-1) === "watch";

		if (isWatch) {
			started++;
			await clock.sleep(HOUR_MS);
		}

		return { value: { exitCode: 0, stdout: `${REPO}/.git\n`, stderr: "", isStdoutTruncated: false, isStderrTruncated: false } };
	});
	on("session.start", (_, e) => ({ cwd: e.cwd }));
	on("fs.stat", () => ({ deny: "ENOENT" }));
	await start($);
	await clock.advance(FIVE_MINUTES_MS);

	expect(started).toBe(1);
});
