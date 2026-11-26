import { type Engine, expect, test } from "claude-code/testing";
import { BAND, CONFIG, type Disk, ENGINE, PANE, engineWith, served, start } from "../fixtures/engine.tsx";
import { NOW, fullStatus } from "../fixtures/status.ts";
import { openingRows } from "./view/pane.ts";

const WIDE = 80;

test("the pane at 45 by 24 shows the header and the first card whole", async ($, on) => {
	engineWith(on, SERVED);
	await start($);

	const ui = await $.ui.mount({ ...PANE, surface: "terminal" });

	expect(await ui.find({ type: "Text", text: /^Mac 40 s ago/ })).toBeDefined();
	expect(await ui.find({ type: "Text", text: /Which title should the release note carry\?/ })).toBeDefined();
	await ui.unmount();
});

test("the band is drawn above another plugin's band and carries the status and the control", async ($, on) => {
	engineWith(on, SERVED);
	await start($);

	const ui = await $.ui.mount({ ...BAND, surface: "terminal" });

	expect(await ui.find({ type: "Text", text: /2 need you/ })).toBeDefined();
	expect(await ui.find({ type: "Text", text: /other plugin's band/ })).toBeDefined();
	await ui.unmount();
});

const HOUR_MS = 3_600_000;
const FIVE_MINUTES_MS = 300_000;
const ONE_POLL_MS = 1_000;

const OTHER_BAND = ["other plugin's band"];

const shownTexts = async ($: Engine): Promise<string[]> => {
	const ui = await $.ui.mount({ ...BAND, surface: "terminal" });
	const texts = (await ui.findAll({ type: "Text" })).map(({ text }) => text);

	await ui.unmount();

	return texts;
};

const SERVED = served(fullStatus);

const UNSERVED_FOLDERS: readonly { readonly where: string; readonly disk: Disk }[] = [
	{ where: "outside a git repository", disk: { ...SERVED, isRepo: false } },
	{ where: "in a repo without hum's config", disk: { ...SERVED, humFiles: [ENGINE] } },
	{ where: "in a repo without hum's pinned engine", disk: { ...SERVED, humFiles: [CONFIG] } },
	{ where: "in a hum repo whose worker never wrote the status file", disk: { ...SERVED, status: undefined } },
];

for (const { where, disk } of UNSERVED_FOLDERS)
	test(`${where}, the mod draws no row, starts no hum and toasts nothing`, async ($, on) => {
		const started: (readonly string[])[] = [];
		const toasts: string[] = [];

		const clock = engineWith(on, disk, (argv) => {
			started.push(argv);
		});

		on("ui.toast", (_, e) => {
			toasts.push(e.text);

			return { value: undefined };
		});
		await start($);
		await clock.advance(FIVE_MINUTES_MS);

		expect(await shownTexts($)).toEqual(OTHER_BAND);
		expect(started).toEqual([]);
		expect(toasts).toEqual([]);
	});

test("a repo whose worker writes its first status file mid-session gets the band within one poll", async ($, on) => {
	const disk: Disk = { ...SERVED, status: undefined };
	const clock = engineWith(on, disk);

	await start($);
	expect(await shownTexts($)).toEqual(OTHER_BAND);

	disk.status = JSON.stringify(fullStatus);
	await clock.advance(ONE_POLL_MS);

	expect(await shownTexts($)).toContain("2 need you");
});

test("a repo where hum stops being set up loses its band and its open pane within one poll", async ($, on) => {
	const disk = served(fullStatus);
	const closed: string[] = [];

	const clock = engineWith(on, disk);

	on("ui.close", (_, e) => {
		closed.push(e.id);

		return { value: undefined };
	});
	await start($);
	disk.humFiles = [CONFIG];
	await clock.advance(ONE_POLL_MS);

	expect(await shownTexts($)).toEqual(OTHER_BAND);
	expect(closed).toEqual(["hum"]);

	const pane = await $.ui.mount({ ...PANE, surface: "terminal" });

	expect(await pane.findAll({ type: "Text" })).toEqual([]);
	await pane.unmount();
});

test("a hum repo whose worker stopped keeps its band, with the worker's age in amber", async ($, on) => {
	engineWith(on, served({ ...fullStatus, writtenAt: NOW - 2 * HOUR_MS, workers: { mac: NOW - 2 * HOUR_MS } }));
	await start($);

	const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: WIDE }, surface: "terminal" });

	expect((await ui.find({ type: "Text", text: /^Mac 2 h$/ }))?.props.color).toBe("warning");
	await ui.unmount();
});

const NARROW = 44;
const INLINE_BODY = 40;

test("the band's open control asks for the rows the first card needs at the inline pane's own width, four cells under the band's", async ($, on) => {
	const asked: (number | undefined)[] = [];

	engineWith(on, SERVED);
	on("ui.open", (_, e) => {
		asked.push(e.rows);

		return { value: { isPlaced: true } };
	});
	await start($);

	const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: NARROW }, surface: "terminal" });
	const control = await ui.find({ type: "Button", text: /open/ });

	await ui.press({ key: control?.key ?? "" });

	const opened = { read: { kind: "status", status: fullStatus }, now: NOW, amberAfterSeconds: 300, dismissed: [] } as const;
	const bandRows = openingRows({ ...opened, width: NARROW });

	expect(asked).toEqual([openingRows({ ...opened, width: INLINE_BODY })]);
	expect(asked).not.toEqual([bandRows]);
	await ui.unmount();
});

test("every card's main action is drawn filled between two caps in the accent colour", async ($, on) => {
	engineWith(on, SERVED);
	await start($);

	const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
	const caps = await ui.findAll({ type: "Text", text: /^[▐▌]$/ });
	const filled = (await ui.findAll({ type: "Text" })).filter(({ props }) => props.backgroundColor !== undefined);

	expect(filled.length).toBeGreaterThan(0);
	expect(caps.map(({ props }) => props.color)).toEqual(filled.flatMap(() => ["suggestion", "suggestion"]));
	expect(new Set(filled.map(({ props }) => `${props.backgroundColor} ${props.color}`))).toEqual(new Set(["suggestion inverseText"]));
	await ui.unmount();
});

test("a card drawn above a question keeps the address of the question's buttons, so the focus stays on the same answer", async ($, on) => {
	const disk = served(fullStatus);
	const clock = engineWith(on, disk);

	await start($);

	const before = await $.ui.mount({ ...PANE, surface: "terminal" });
	const short = await before.find({ type: "Button", text: /short/ });

	await before.unmount();
	disk.status = JSON.stringify({ ...fullStatus, questions: [{ item: "80", text: "Which name?", options: ["a", "b"], since: NOW - 9_000_000 }, ...fullStatus.questions] });
	disk.modified = 2;
	await clock.advance(FIVE_MINUTES_MS);

	const after = await $.ui.mount({ ...PANE, surface: "terminal" });

	expect(await after.find({ type: "Text", text: /Which name\?/ })).toBeDefined();
	expect((await after.find({ type: "Button", text: /short/ }))?.key).toBe(short?.key);
	await after.unmount();
});

test("a hum watch that does not answer is not started again while it runs", async ($, on) => {
	let started = 0;

	const clock = engineWith(on, SERVED, async () => {
		started++;
		await clock.sleep(HOUR_MS);
	});

	await start($);
	await clock.advance(FIVE_MINUTES_MS);

	expect(started).toBe(1);
});
