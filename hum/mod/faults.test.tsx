import { type Engine, expect, test } from "claude-code/testing";
import type { Card } from "../../hum-engine/src/status/format.ts";
import type { Dismissal } from "../types";
import { BAND, type Disk, PANE, engineWith, served, start } from "../fixtures/engine.tsx";
import { faultStatus, SLOT_1, SLOT_2 } from "../fixtures/fault-status.ts";

const WIDE = 80;
const ONE_POLL_MS = 1_000;
const SLOTS_DISMISS = "dismiss:slot-out:slot-1,slot-out:slot-2";
const BOTH_SLOTS: readonly Dismissal[] = [SLOT_1, SLOT_2].map(({ key, since }) => ({ key, since }));

const dismissedFile = (cards: readonly Dismissal[], modified: number): Disk["dismissed"] => ({ text: JSON.stringify(cards), modified });

const textsOf = async ($: Engine, surface: typeof PANE | typeof BAND): Promise<string[]> => {
	const ui = await $.ui.mount({ ...surface, props: { ...surface.props, bodyColumns: WIDE }, surface: "terminal" });
	const texts = (await ui.findAll({ type: "Text" })).map(({ text }) => text);

	await ui.unmount();

	return texts;
};

const slotsShown = async ($: Engine): Promise<string | undefined> => (await textsOf($, PANE)).find((text) => /slot-1, slot-2/.test(text));

test("the four fault cards the owner saw show as three, the two slots out on one check as one card naming both at the older age", async ($, on) => {
	engineWith(on, served(faultStatus));
	await start($);

	const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: WIDE }, surface: "terminal" });
	const titles = (await pane.findAll({ type: "Text" })).map(({ text }) => text).filter((text) => text.includes(" · fault · "));
	const buttons = (await pane.findAll({ type: "Button" })).flatMap(({ key }) => (key?.startsWith("dismiss:") ? [key] : []));

	await pane.unmount();

	expect(titles).toEqual([" slot-1, slot-2 · fault · 23 m ", " row-refused · fault · 15 m ", " worker-down · fault · 1 m "]);
	expect(buttons).toEqual([SLOTS_DISMISS, "dismiss:row-refused", "dismiss:worker-down"]);
	expect(await textsOf($, BAND)).toContain("3 faults");
});

test("Dismiss hides the card in the pane and the band, and the file keeps only dismissals whose card is still raised", async ($, on) => {
	const disk = { ...served(faultStatus), dismissed: dismissedFile([{ key: "slot-out:slot-9", since: 1 }], 1) };

	engineWith(on, disk);
	await start($);

	const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: WIDE }, surface: "terminal" });

	await pane.press({ key: SLOTS_DISMISS });
	await pane.unmount();

	expect(await slotsShown($)).toBeUndefined();
	expect(await textsOf($, BAND)).toContain("2 faults");
	expect(JSON.parse(disk.dismissed?.text ?? "null")).toEqual(BOTH_SLOTS);
});

test("a card another pane on the repo dismissed hides here within one poll", async ($, on) => {
	const disk = served(faultStatus);
	const clock = engineWith(on, disk);

	await start($);
	expect(await slotsShown($)).toBeDefined();

	disk.dismissed = dismissedFile(BOTH_SLOTS, 1);
	await clock.advance(ONE_POLL_MS);

	expect(await slotsShown($)).toBeUndefined();
});

const SLOT_3: Card = { ...SLOT_2, key: "slot-out:slot-3", item: "slot-3", cause: SLOT_2.cause.replaceAll("slot-2", "slot-3") };

const COMEBACKS: readonly { readonly when: string; readonly cards: readonly Card[]; readonly title: RegExp }[] = [
	{ when: "one of its places cleared and was raised again", cards: [SLOT_1, { ...SLOT_2, since: SLOT_2.since + ONE_POLL_MS }], title: /^ slot-1, slot-2 · fault/ },
	{ when: "a new place joins it", cards: [SLOT_1, SLOT_2, SLOT_3], title: /^ slot-1, slot-2, slot-3 · fault/ },
];

for (const { when, cards, title } of COMEBACKS)
	test(`a dismissed card shows again, naming every place, when ${when}`, async ($, on) => {
		engineWith(on, { ...served({ ...faultStatus, cards: [...cards] }), dismissed: dismissedFile(BOTH_SLOTS, 1) });
		await start($);

		expect((await textsOf($, PANE)).filter((text) => title.test(text))).toHaveLength(1);
	});
