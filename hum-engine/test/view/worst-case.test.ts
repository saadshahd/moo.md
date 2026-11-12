import { expect, test } from "bun:test";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { NOW } from "../../../hum/fixtures/status.ts";
import { hugeStatus, LONGEST_ID, worstStatus } from "../../../hum/fixtures/worst-status.ts";
import { type BandInput, bandRow } from "../../../hum/mod/view/band.ts";
import { noticeCardRows, questionCardRows } from "../../../hum/mod/view/cards.ts";
import { rowCells } from "../../../hum/mod/view/cells.ts";
import { headerRow, measureRow, tokensText } from "../../../hum/mod/view/header.ts";
import { openingRows, paneRows } from "../../../hum/mod/view/pane.ts";
import type { ViewRead } from "../../../hum/mod/view/read.ts";
import type { Row } from "../../../hum/mod/view/row.ts";

const AMBER_AFTER = 15;
const WIDTHS = [20, 21, 33, 40, 41, 60, 80, 110, 143, 200];
const BELOW_THE_SMALLEST_WIDTH = [1, 2, 5, 12, 19];

const MULTILINE_ERROR = "✖ Invalid input: expected array, received string\n  → at questions\n\u001b[31m✖\u001b[0m Invalid input\t→ at cards[0].cause";

const UNREAD: NonNullable<BandInput["unread"]> = {
	cause: "git ls-remote exited 128: fatal: unable to access the remote\n\tCould not resolve host\u001b[31m example.com\u001b[0m",
	since: NOW - 60_000,
};

const READS: readonly ViewRead[] = [
	{ kind: "status", status: worstStatus },
	{ kind: "waiting" },
	{ kind: "missing", path: `/Users/someone/${"a-very-deep-folder/".repeat(8)}.git/hum/status.json` },
	{ kind: "unreadable", message: MULTILINE_ERROR },
	{ kind: "unsupported", format: "x".repeat(80) },
	{ kind: "unsupported", format: 1_000_000_000 },
];

const BAND_STATES: readonly Partial<BandInput>[] = [{}, { answering: LONGEST_ID }, { unread: UNREAD }];

const foldIdsOf = ({ inFlight, merged, choices }: typeof worstStatus): Set<string> =>
	new Set([...inFlight.map(({ item }) => `in-flight:${item}`), ...merged.map(({ item }) => `merged:${item}`), ...choices.map(({ item, at }) => `choice:${item}:${at}`)]);

const drawn = (row: Row): string => row.map(({ text }) => text).join("");

const bandsAt = (width: number): Row[] => READS.flatMap((read) => BAND_STATES.map((state) => bandRow({ read, now: NOW, amberAfterSeconds: AMBER_AFTER, width, ...state })));

const panesAt = (width: number): Row[] =>
	READS.flatMap((read) => [
		...paneRows({ read, now: NOW, amberAfterSeconds: AMBER_AFTER, width, unfolded: new Set() }),
		...paneRows({ read, now: NOW, amberAfterSeconds: AMBER_AFTER, width, unfolded: foldIdsOf(worstStatus) }),
		...paneRows({ read, now: NOW, amberAfterSeconds: AMBER_AFTER, width, unfolded: new Set(), unread: UNREAD }),
	]);

const headersAt = (width: number): Row[] => [headerRow(worstStatus, { now: NOW, amberAfterSeconds: AMBER_AFTER, width: width }), measureRow(worstStatus.measure, width), measureRow(null, width)];

const NOT_DRAWABLE = /\p{Cc}/u;
const PRINTED_JUNK = /NaN|undefined|null|Infinity|\[object/;

const FAULTS: readonly { readonly name: string; readonly isFoundIn: (row: Row, width: number) => boolean }[] = [
	{ name: "past the width", isFoundIn: (row, width) => rowCells(row) > width },
	{ name: "holds a control character", isFoundIn: (row) => NOT_DRAWABLE.test(drawn(row)) },
	{ name: "prints a broken value", isFoundIn: (row) => PRINTED_JUNK.test(drawn(row)) },
];

test("worst-case data never makes a row pass its width, hold a control character or print a broken value, from 20 to 200 cells", () => {
	const broken = WIDTHS.flatMap((width) =>
		[...bandsAt(width), ...panesAt(width), ...headersAt(width)].flatMap((row) =>
			FAULTS.flatMap(({ name, isFoundIn }) => (isFoundIn(row, width) ? [`${width} cells, ${name}: ${JSON.stringify(drawn(row).slice(0, 80))}`] : [])),
		),
	);

	expect(broken).toEqual([]);
});

const isPadded = (row: Row, width: number): boolean => row.at(0)?.text === " " && row.at(-1)?.text === " " && rowCells(row) <= width;

test("every pane and band row has one empty cell at each side, inside its width", () => {
	const unpadded = WIDTHS.flatMap((width) => [...bandsAt(width), ...panesAt(width)].flatMap((row) => (isPadded(row, width) ? [] : [`${width} cells: ${JSON.stringify(drawn(row).slice(0, 60))}`])));

	expect(unpadded).toEqual([]);
});

test("a view narrower than any it is built for still draws and does not throw", () => {
	for (const width of BELOW_THE_SMALLEST_WIDTH) {
		expect(() => [...bandsAt(width), ...panesAt(width), ...headersAt(width)]).not.toThrow();
		expect(() => openingRows({ read: READS[0] ?? { kind: "waiting" }, now: NOW, amberAfterSeconds: AMBER_AFTER, width })).not.toThrow();
	}
});

test.each(WIDTHS)("a tool's newline and tab in a question show as the words they hold at width %p", (width) => {
	const question = { item: "71", text: "Which one?\nThe short title or\tthe long one?", options: [], since: NOW };

	const asked = questionCardRows(question, { now: NOW, width })
		.slice(1)
		.filter((row) => !row.some(({ press }) => press !== undefined))
		.map(drawn);

	expect(asked.join(" ")).toBe("Which one? The short title or the long one?");
});

test("a tool's colour codes in a card show as the words they hold", () => {
	const [cause] = noticeCardRows(
		{ kind: "fault", key: "k", item: "72", code: "check-failed", cause: "\u001b[31mFAIL\u001b[0m test/a.test.ts > renders the pane\u001b[2K\r expected 1 to be 2", fix: "Fix it.", since: NOW },
		{ now: NOW, width: 200 },
	).slice(1);

	expect(cause === undefined ? "" : drawn(cause)).toBe("FAIL test/a.test.ts > renders the pane expected 1 to be 2");
});

const STATUS_READ: ViewRead = { kind: "status", status: worstStatus };

const UNREAD_INPUT = { read: STATUS_READ, now: NOW, amberAfterSeconds: AMBER_AFTER, width: 200 };

test("a read of the work source that keeps failing says so in a few words in the band", () => {
	const band = drawn(bandRow({ ...UNREAD_INPUT, unread: UNREAD }));

	expect(band).toContain("work source unread 1 m");
	expect(band).not.toContain("ls-remote");
});

test("a read of the work source that keeps failing gives its cause whole in the pane", () => {
	const pane = paneRows({ ...UNREAD_INPUT, unfolded: new Set(), unread: UNREAD }).map(drawn);

	expect(pane.find((line) => line.includes("work source")) ?? "").toContain("unread · 1 m");
	expect(pane.find((line) => line.includes("ls-remote")) ?? "").toContain("git ls-remote exited 128: fatal: unable to access the remote Could not resolve host example.com");
});

test("a read of the work source that failed only briefly shows in neither the band nor the pane", () => {
	const brief = { ...UNREAD, since: NOW - 5000 };

	expect(drawn(bandRow({ ...UNREAD_INPUT, unread: brief }))).not.toContain("work source unread");
	expect(
		paneRows({ ...UNREAD_INPUT, unfolded: new Set(), unread: brief })
			.map(drawn)
			.join("\n"),
	).not.toContain("ls-remote");
});

test("the opening rows of an inline pane end where its first card ends, with or without an unread read", () => {
	for (const unread of [undefined, UNREAD]) {
		const rows = paneRows({ read: STATUS_READ, now: NOW, amberAfterSeconds: AMBER_AFTER, width: 80, unfolded: new Set(), unread });
		const opening = openingRows({ read: STATUS_READ, now: NOW, amberAfterSeconds: AMBER_AFTER, width: 80, unread });

		expect([drawn(rows[opening - 1] ?? []).trim() === "", drawn(rows[opening] ?? []).trim() === ""]).toEqual([false, true]);
	}
});

test("a count of one says needs and a count above one says need", () => {
	const band = (questions: number) =>
		drawn(bandRow({ read: { kind: "status", status: { ...worstStatus, questions: worstStatus.questions.slice(0, questions) } }, now: NOW, amberAfterSeconds: AMBER_AFTER, width: 200 }));

	expect(band(1)).toContain("1 needs you");
	expect(band(2)).toContain("2 need you");
});

test("a token count rounds up into the next unit and never reads 1000k", () => {
	expect(["0", "499", "500", "999", "1000", "999.6", "1499", "999_499", "999_500", "999_999", "12_345_678"].map((count) => tokensText(Number(count.replaceAll("_", ""))))).toEqual([
		"0",
		"499",
		"500",
		"999",
		"1k",
		"1k",
		"1k",
		"999k",
		"1.0M",
		"1.0M",
		"12.3M",
	]);
});

test("the worst-case lists are as long as the shipped settings allow", () => {
	expect([worstStatus.merged.length, worstStatus.choices.length]).toEqual([SHIPPED_DEFAULTS.mergedShown, SHIPPED_DEFAULTS.choicesShown]);
});

test("a status file with no items draws only its header", () => {
	const empty = { ...worstStatus, questions: [], cards: [], inFlight: [], merged: [], choices: [] };

	expect(paneRows({ read: { kind: "status", status: empty }, now: NOW, amberAfterSeconds: AMBER_AFTER, width: 80, unfolded: new Set() })).toHaveLength(2);
});

test("a status file with hundreds of items lists every item once", () => {
	const listed = new Set(paneRows({ read: { kind: "status", status: hugeStatus }, now: NOW, amberAfterSeconds: AMBER_AFTER, width: 80, unfolded: new Set() }).map(([, first]) => first?.text));

	expect(hugeStatus.merged.filter(({ item }) => !listed.has(`#${item}`))).toEqual([]);
	expect(hugeStatus.inFlight.filter(({ item }) => item !== LONGEST_ID && !listed.has(`#${item}`))).toEqual([]);
});
