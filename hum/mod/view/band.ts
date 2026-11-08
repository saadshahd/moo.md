import { cells, ellipsize, rowCells, spaces } from "./cells.ts";
import { SEPARATOR } from "./glyphs.ts";
import { RUNNERS, runnerPart } from "./ages.ts";
import { type Row, type Span, span } from "./row.ts";
import { statusWords } from "./summary.ts";
import type { ViewRead } from "./read.ts";

export type BandInput = { readonly read: ViewRead; readonly now: number; readonly amberAfterSeconds: number; readonly width: number };

const NAME = "hum";
const CONTROL = "open";
const MIN_GAP = 2;

const joined = (parts: readonly Span[]): Span[] => parts.flatMap((part, index) => (index === 0 ? [part] : [span(SEPARATOR, "dim"), part]));

type Parts = { readonly name: Span; readonly status: Span; readonly mac?: Span; readonly ci?: Span; readonly version?: Span };

/** What drops first when the row is short. The status and the control never drop. */
const DROP_ORDER = ["version", "ci", "mac", "name"] as const;

const shown = (parts: Parts, dropped: number): Span[] => {
	const gone = new Set<string>(DROP_ORDER.slice(0, dropped));
	const keep = (key: keyof Parts): Span[] => (gone.has(key) || parts[key] === undefined ? [] : [parts[key]]);

	return joined([...keep("name"), parts.status, ...keep("mac"), ...keep("ci"), ...keep("version")]);
};

const partsOf = ({ read, now, amberAfterSeconds }: BandInput): Parts => {
	const name = span(NAME, "strong");

	if (read.kind !== "status") return { name, status: span(statusWords(read), "amber") };

	const { status } = read;

	return {
		name,
		status: span(statusWords(read), status.questions.length > 0 ? "strong" : "plain"),
		mac: runnerPart(status, RUNNERS[0], now, amberAfterSeconds),
		ci: runnerPart(status, RUNNERS[1], now, amberAfterSeconds),
		version: span(status.engine.version, "dim"),
	};
};

/** The band: one row, the control at the right end. The status and the control stay whole from 40 cells; name, ages and version drop from the end. */
export const bandRow = (input: BandInput): Row => {
	const { width } = input;
	const parts = partsOf(input);
	const control = span(CONTROL, "strong", { kind: "open" });
	const room = width - cells(CONTROL) - MIN_GAP;
	const left = DROP_ORDER.map((_, dropped) => shown(parts, dropped)).concat([shown(parts, DROP_ORDER.length)]).find((candidate) => rowCells(candidate) <= room);

	if (left === undefined) return room > 0 ? [span(ellipsize(parts.status.text, room), parts.status.tone), span(spaces(MIN_GAP), "plain"), control] : [span(ellipsize(CONTROL, width), "strong", control.press)];

	return [...left, span(spaces(width - rowCells(left) - cells(CONTROL)), "plain"), control];
};
