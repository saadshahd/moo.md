import { expect, test } from "bun:test";
import { fullStatus, NOW } from "../../../hum/fixtures/status.ts";
import { agesShown } from "../../../hum/mod/view/ages.ts";
import { bandRow } from "../../../hum/mod/view/band.ts";
import { button, buttonRows } from "../../../hum/mod/view/buttons.ts";
import {
	noticeCardRows,
	questionCardRows,
} from "../../../hum/mod/view/cards.ts";
import { cells, rowCells } from "../../../hum/mod/view/cells.ts";
import {
	ageSeconds,
	ageText,
	isAmber,
} from "../../../hum/mod/view/freshness.ts";
import { headerRow, measureRow } from "../../../hum/mod/view/header.ts";
import { listRows } from "../../../hum/mod/view/lists.ts";
import { openingRows, paneRows } from "../../../hum/mod/view/pane.ts";
import {
	parseStatus,
	statusPathOf,
	type ViewRead,
} from "../../../hum/mod/view/read.ts";
import { STATUS_FORMAT } from "../../src/status/version.ts";
import type { Row } from "../../../hum/mod/view/row.ts";
import { span } from "../../../hum/mod/view/row.ts";

const WIDTHS = Array.from({ length: 181 }, (_, index) => 20 + index);
const AMBER_AFTER = 15;

/** Texts that break naive width code: wide characters, emoji sequences, one long path, a long word, a bare number. */
const AWKWARD = [
	"Which title?",
	`${"日本語の題名".repeat(8)}?`,
	`${"emoji 😀 👨‍👩‍👧 mix ".repeat(4)}?`,
	`/very/long/path/${"to/a/file/".repeat(6)}name.ts`,
	"#99999",
	"x".repeat(120),
];

const textOf = (row: Row): string => row.map(({ text }) => text).join("");

const withoutSpaces = (text: string): string => text.replaceAll(" ", "");

const statusRead: ViewRead = { kind: "status", status: fullStatus };

const READS: readonly ViewRead[] = [
	statusRead,
	{ kind: "waiting" },
	{ kind: "missing", path: "/repo/.git/hum/status.json" },
	{ kind: "unreadable", message: "Unexpected token" },
	{ kind: "unsupported", format: 2 },
	{
		kind: "status",
		status: {
			...fullStatus,
			workers: {},
			questions: [],
			cards: [],
			measure: null,
		},
	},
];

const inputOf = (read: ViewRead, width: number) => ({
	read,
	now: NOW,
	amberAfterSeconds: AMBER_AFTER,
	width,
});

test("the band is one row that never passes its width, from 20 to 200 cells, for every state of the status file", () => {
	for (const read of READS) {
		for (const width of WIDTHS)
			expect(
				rowCells(bandRow(inputOf(read, width))),
				`${read.kind} at ${width}`,
			).toBeLessThanOrEqual(width);
	}
});

test("from 42 cells the band keeps its status whole and the control one cell from the right end", () => {
	for (const width of WIDTHS.filter((one) => one >= 42)) {
		const row = bandRow(inputOf(statusRead, width));

		expect(textOf(row), String(width)).toContain("2 need you");
		expect(row.at(-2)?.text).toBe("open");
		expect(rowCells(row)).toBe(width);
	}
});

test("the band drops its version, then the CI age, then the Mac age, then its name, and never its status", () => {
	const shown = (width: number) => textOf(bandRow(inputOf(statusRead, width)));

	expect(shown(80)).toContain("0.3.0");
	expect(shown(44)).not.toContain("0.3.0");
	expect(shown(44)).toContain("CI 6 m");
	expect(shown(38)).not.toContain("CI");
	expect(shown(38)).toContain("Mac 40 s");
	expect(shown(30)).not.toContain("Mac");
	expect(shown(30)).toContain("hum");
	expect(shown(21)).not.toContain("hum");
	expect(shown(21)).toContain("2 need you");
});

test("the header and the measure line are one row each at every width, and the notes stay", () => {
	for (const width of WIDTHS) {
		expect(
			rowCells(headerRow(fullStatus, NOW, AMBER_AFTER, width)),
			String(width),
		).toBeLessThanOrEqual(width);

		const measure = measureRow(fullStatus.measure, width);

		expect(rowCells(measure), String(width)).toBeLessThanOrEqual(width);
		expect(textOf(measure)).toContain("notes");
		expect(rowCells(measureRow(null, width))).toBeLessThanOrEqual(width);
	}
});

test("the measure line drops tokens, then questions, then its label", () => {
	const shown = (width: number) =>
		textOf(measureRow(fullStatus.measure, width));

	expect(shown(80)).toBe(
		"per merge (last 20): 0.4 notes · 0.2 questions · 310k tokens",
	);
	expect(shown(50)).toBe("per merge (last 20): 0.4 notes · 0.2 questions");
	expect(shown(30)).toBe("per merge (last 20): 0.4 notes");
	expect(shown(20)).toBe("0.4 notes");
});

test("a question is never cut: every character comes back at every width", () => {
	for (const text of AWKWARD) {
		for (const width of WIDTHS) {
			const rows = questionCardRows(
				{ item: "68", text, options: [], since: NOW - 5_580_000 },
				NOW,
				width,
			);

			for (const row of rows)
				expect(rowCells(row), `${text} at ${width}`).toBeLessThanOrEqual(width);

			expect(withoutSpaces(rows.slice(1, -1).map(textOf).join(""))).toBe(
				withoutSpaces(text),
			);
			expect(rows.map(textOf).join("")).not.toContain("…");
		}
	}
});

test("a card's title loses parts from the end and keeps its item", () => {
	const card = fullStatus.cards[0];
	const title = (width: number) => textOf(card === undefined ? [] : (noticeCardRows(card, NOW, width)[0] ?? []));

	expect(title(60)).toContain("71 · fault · 5 m");
	expect(title(20)).toContain("71 · fault");
	expect(title(20)).not.toContain("5 m");
});

test("a notice card gives the cause, then the fix, then its one action whole, which fills an answer to its item, at every width", () => {
	for (const card of fullStatus.cards) {
		for (const width of WIDTHS) {
			const rows = noticeCardRows(card, NOW, width);

			for (const row of rows)
				expect(rowCells(row), `${card.key} at ${width}`).toBeLessThanOrEqual(
					width,
				);

			const actions = rows.flatMap((row) =>
				row.filter(({ press }) => press !== undefined),
			);

			expect(actions.map(({ text, press }) => ({ text, press }))).toEqual(
				card.action === undefined ? [] : [{ text: `▐ ${card.action.label} ▌`, press: { kind: "fill", item: card.item ?? "", word: card.action.answer } }],
			);
		}
	}
});

test("buttons are whole, two cells apart and right-aligned; one that does not fit starts a new row", () => {
	const labels = [
		"approve",
		"change the plan",
		"file follow-up",
		"x".repeat(14),
	];

	const buttons = labels.map((label, index) =>
		button(label, { kind: "fill", item: "68", word: label }, index === 0),
	);

	expect(buttons.map(({ tone }) => tone)).toEqual(["filled", "dim", "dim", "dim"]);
	expect(buttons[0]?.text).toBe("▐ approve ▌");
	expect(buttons[1]?.text).toBe(" change the plan ");

	for (const width of WIDTHS) {
		const rows = buttonRows(buttons, width);

		const shown = rows.flatMap((row) =>
			row.filter(({ press }) => press !== undefined).map(({ text }) => text),
		);

		for (const row of rows) expect(rowCells(row), String(width)).toBe(width);

		expect(shown).toEqual(buttons.map(({ text }) => text));
	}
});

const LONG_TITLE = `Rename the release script and update every workflow that calls it ${"and then some ".repeat(6)}`;

const ENTRY = {
	foldId: "in-flight:72",
	item: "72",
	title: LONG_TITLE,
	meta: [
		span("medium unclear", "amber"),
		span("building", "plain"),
		span("4 m", "dim"),
	],
};

test("a list row is one line while its title has room, ends a cut title in an ellipsis that unfolds, and goes under the id when narrow", () => {
	for (const width of WIDTHS) {
		const folded = listRows(ENTRY, false, width);

		for (const row of folded)
			expect(rowCells(row), String(width)).toBeLessThanOrEqual(width);

		const cut = folded.flatMap((row) =>
			row.filter(({ text }) => text.endsWith("…")),
		);

		for (const part of cut)
			expect(part.press).toEqual({ kind: "fold", id: ENTRY.foldId });

		const unfolded = listRows(ENTRY, true, width);

		for (const row of unfolded)
			expect(rowCells(row)).toBeLessThanOrEqual(width);

		expect(unfolded.map(textOf).join("")).not.toContain("…");
		expect(withoutSpaces(unfolded.slice(1).map(textOf).join(""))).toBe(
			withoutSpaces(LONG_TITLE),
		);
	}

	expect(listRows(ENTRY, false, 120)).toHaveLength(1);
	expect(listRows(ENTRY, false, 30)).toHaveLength(2);
});

test("an unclear item carries the word beside its level", () => {
	expect(listRows(ENTRY, false, 120).map(textOf).join("")).toContain(
		"medium unclear",
	);
});

test("every row of the pane stays inside its width, and the unfolded set draws its rows whole", () => {
	for (const read of READS) {
		for (const width of WIDTHS) {
			const rows = paneRows({
				...inputOf(read, width),
				unfolded: new Set(["in-flight:seed-3", "merged:69", "choice:70:1"]),
			});

			for (const row of rows)
				expect(rowCells(row), `${read.kind} at ${width}`).toBeLessThanOrEqual(
					width,
				);
		}
	}
});

test("the pane lists question cards, then waiting, limited and fault cards, then in flight, merged and choices made without you", () => {
	const text = paneRows({
		...inputOf(statusRead, 80),
		unfolded: new Set(),
	}).map(textOf);

	const at = (needle: string) =>
		text.findIndex((line) => line.includes(needle));

	const order = [
		"Which title should",
		"May the run publish",
		"waiting",
		"limited",
		"fault",
		"in flight (2)",
		"merged (1)",
		"choices made without you (1)",
	].map(at);

	expect(order.every((index) => index >= 0)).toBe(true);
	expect(order).toEqual([...order].sort((a, b) => a - b));
});

test("an inline pane opens as tall as its header and first card", () => {
	const rows = paneRows({ ...inputOf(statusRead, 45), unfolded: new Set() });

	const firstCardEnd =
		rows.findIndex(
			(row, index) => index > 0 && textOf(row).includes("May the run publish"),
		) - 2;

	expect(openingRows(statusRead, NOW, AMBER_AFTER, 45)).toBe(firstCardEnd);
});

test("an age is never negative, grows with the clock, and is amber exactly past the limit", () => {
	for (const at of [0, 1_000, NOW - 14_000, NOW]) {
		let previous = -1;

		for (const now of [
			at - 5_000,
			at,
			at + 999,
			at + 1_000,
			at + 14_999,
			at + 15_000,
			at + 15_999,
			at + 16_000,
			at + 3_600_000,
		]) {
			const age = ageSeconds(at, now);

			expect(age).toBeGreaterThanOrEqual(0);
			expect(age).toBeGreaterThanOrEqual(previous);
			previous = age;
			expect(isAmber(age, AMBER_AFTER)).toBe(age > AMBER_AFTER);
		}
	}

	expect(isAmber(15, AMBER_AFTER)).toBe(false);
	expect(isAmber(16, AMBER_AFTER)).toBe(true);
});

test("an age reads in its two biggest units", () => {
	expect(
		[0, 40, 59, 60, 360, 3599, 3600, 5580, 90_000, 187_200].map(ageText),
	).toEqual([
		"0 s",
		"40 s",
		"59 s",
		"1 m",
		"6 m",
		"59 m",
		"1 h",
		"1 h 33 m",
		"1 d 1 h",
		"2 d 4 h",
	]);
});

test("a redraw is due exactly when a shown age or its colour changes", () => {
	const shown = (now: number) => agesShown(fullStatus, now, AMBER_AFTER);

	expect(shown(NOW)).not.toBe(shown(NOW + 1_000));
	expect(shown(NOW)).toBe(agesShown(fullStatus, NOW + 100, AMBER_AFTER));
});

test("the status file's format number decides what the view reads", () => {
	expect(parseStatus(JSON.stringify(fullStatus)).kind).toBe("status");
	expect(parseStatus(JSON.stringify({ ...fullStatus, format: STATUS_FORMAT + 1 }))).toEqual({
		kind: "unsupported",
		format: STATUS_FORMAT + 1,
	});
	expect(parseStatus("null")).toEqual({ kind: "unsupported", format: "none" });
	expect(parseStatus("{").kind).toBe("unreadable");
});

test("the status file sits in the repo's git common dir, from the main checkout and from a worktree", () => {
	expect(statusPathOf("/repo", ".git")).toBe("/repo/.git/hum/status.json");
	expect(statusPathOf("/repo", ".")).toBe("/repo/hum/status.json");
	expect(statusPathOf("/repo/.worktrees/a", "/repo/.git")).toBe(
		"/repo/.git/hum/status.json",
	);
});

test("width counting follows string-width: a wide character takes two cells", () => {
	expect(cells("日本")).toBe(4);
	expect(cells("abc")).toBe(3);
});
