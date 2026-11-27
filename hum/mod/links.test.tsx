import { expect, test } from "claude-code/testing";
import { PANE, engineWith, served, start } from "../fixtures/engine.tsx";
import { linkedStatus } from "../fixtures/status.ts";

const WIDE = 80;

const FEED = { HUM_FEED_ITEM: "74" };

test("an item's feed row opens hum's pane on that item alone: its title line, each run with its Status, its question and its handoff Pad", async ($, on) => {
	const opened: string[] = [];

	engineWith(on, served(linkedStatus), () => undefined, FEED);
	on("ui.open", (_, e) => {
		opened.push(e.id);

		return { value: { isPlaced: true } };
	});
	await start($);

	const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: WIDE }, surface: "terminal" });
	const texts = (await ui.findAll({ type: "Text" })).map(({ text }) => text).join("\n");

	expect(opened).toEqual(["hum"]);
	expect(texts).toMatch(/#74 Add exam export · owner-review · waiting on you/);
	expect(texts).toMatch(/▸ build {5}done/);
	expect(texts).toMatch(/▸ ask 1 {5}needs-you/);
	expect(texts).toMatch(/Approve the release workflow change\?/);
	expect(texts).toMatch(/handoff: Pad "#74 handoff"/);
	expect(texts).not.toMatch(/#68|#72|Which title/);
	await ui.unmount();
});

test("a question's open control opens the row that asks it in the roundup App, and a run's opens that run's row", async ($, on) => {
	const ran: (readonly string[])[] = [];

	engineWith(on, served(linkedStatus), (argv) => void ran.push(argv), FEED);
	on("ui.open", () => ({ value: { isPlaced: true } }));
	await start($);

	const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: WIDE }, surface: "terminal" });
	const opens = await ui.findAll({ type: "Button", text: /open ↗/ });

	for (const control of opens) await ui.press({ key: control.key ?? "" });

	expect(ran.filter(([command]) => command === "open")).toEqual([
		["open", "roundup://agent/21?project=key"],
		["open", "roundup://agent/22?project=key"],
		["open", "roundup://agent/24?project=key"],
		["open", "roundup://agent/24?project=key"],
		["open", "roundup://pad/%2374%20handoff?project=key"],
	]);
	await ui.unmount();
});
