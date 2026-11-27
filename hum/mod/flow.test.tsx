import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";
import { ENGINE, PANE, engineWith, served, start } from "../fixtures/engine.tsx";
import { fullStatus } from "../fixtures/status.ts";

const WIDE = 88;

/** Enter answers at once and the post runs after it; a tick of the clock lets it land. */
const POST_SETTLES_MS = 10;

/** The prompt box: what fills write, read back as the owner left it. */
const promptBox = (on: On) => {
	const box = { text: "" };

	on("prompt.read", () => ({ value: { text: box.text, cursor: box.text.length } }));
	on("prompt.fill", (_, e) => {
		box.text = e.mode === "replace" ? e.text : `${box.text}${e.text}`;

		return { isFilled: true, box: { text: box.text, cursor: box.text.length } };
	});

	return box;
};

/** What the mod ran of the repo's hum, without the engine's path. */
const humRuns = (ran: readonly (readonly string[])[]): string[][] => ran.flatMap(([command, ...args]) => (command === ENGINE ? [args] : []));

test("a step picked in an item's note picker fills the prompt with a sentence to that step, and the owner's Enter sends the finished note to it with hum note", async ($, on) => {
	const ran: (readonly string[])[] = [];

	const clock = engineWith(on, served(fullStatus), (argv) => void ran.push(argv));
	const box = promptBox(on);

	await start($);

	const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: WIDE }, surface: "terminal" });

	await ui.select({ key: "note-to:74", value: "reviewing" });
	expect(box.text).toBe("#74 note for reviewing: ");

	box.text = "#74 note for reviewing: keep the old script name";
	await $.prompt.submit({ text: box.text, origin: { kind: "composer" }, wait: false });
	await clock.advance(POST_SETTLES_MS);

	expect(humRuns(ran)).toContainEqual(["note", "--", "74", "reviewing", "keep the old script name"]);
	await ui.unmount();
});

test("an item's run now and skip buttons ask the repo's hum at the step the item is at, and say what was asked", async ($, on) => {
	const ran: (readonly string[])[] = [];
	const toasts: string[] = [];
	const open = fullStatus.open.map((item) => (item.item === "74" ? { ...item, controls: { ...item.controls, skip: true, runNow: true } } : item));

	engineWith(on, served({ ...fullStatus, open }), (argv) => void ran.push(argv));
	on("ui.toast", (_, e) => {
		toasts.push(e.text);

		return { value: undefined };
	});
	await start($);

	const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: WIDE }, surface: "terminal" });

	for (const label of [/run now/, /skip/]) await ui.press({ key: (await ui.find({ type: "Button", text: label }))?.key ?? "" });

	expect(toasts).toEqual(["hum: #74: asked to run owner-review's timer now", "hum: #74: asked to skip owner-review"]);
	expect(humRuns(ran).filter(([command]) => command !== "watch")).toEqual([
		["run-now", "74", "owner-review"],
		["skip", "74", "owner-review"],
	]);
	await ui.unmount();
});
