import type { Unread } from "../../types";
import { cells, ellipsize, rowCells, spaces } from "./cells.ts";
import { fitting, joinParts, shortenings } from "./fit.ts";
import { reportedUnread, sinceText } from "./freshness.ts";
import { RUNNERS, runnerPart } from "./ages.ts";
import { innerWidth, padded, type Row, type Span, span } from "./row.ts";
import { statusWords } from "./summary.ts";
import type { ViewRead } from "./read.ts";

export type BandInput = {
	readonly read: ViewRead;
	readonly now: number;
	readonly amberAfterSeconds: number;
	readonly width: number;
	/** The item whose thread Enter posts on, while answer mode is on. */
	readonly answering?: string;
	readonly unread?: Unread;
};

const NAME = "hum";
const CONTROL = "open";
const MIN_GAP = 2;

type Parts = { readonly name: Span; readonly status: Span; readonly mac?: Span; readonly ci?: Span; readonly version?: Span };

/** What stays longest when the row is short, first to last. The status and the control never drop. */
const KEEP_ORDER = ["name", "mac", "ci", "version"] as const;

type Droppable = (typeof KEEP_ORDER)[number];

const shown = (parts: Parts, kept: readonly Droppable[]): Row => {
	const keep = (key: Droppable): Span[] => (kept.includes(key) && parts[key] !== undefined ? [parts[key]] : []);

	return joinParts([...keep("name"), parts.status, ...keep("mac"), ...keep("ci"), ...keep("version")]);
};

/** What the status part says: answer mode first, then a read that keeps failing, then the engine's state. */
const statusPart = ({ read, now, amberAfterSeconds, answering, unread }: BandInput): Span => {
	if (answering !== undefined) return span(`Enter posts on ${answering}, not Claude`, "strong");

	const reported = reportedUnread(unread, now, amberAfterSeconds);

	if (reported !== undefined) return span(`work source unread ${sinceText(reported.since, now)}`, "amber");

	if (read.kind !== "status") return span(statusWords(read), "amber");

	return span(statusWords(read), read.status.questions.length > 0 ? "strong" : "plain");
};

const partsOf = (input: BandInput): Parts => {
	const { read, now, amberAfterSeconds } = input;
	const name = span(NAME, "strong");
	const status = statusPart(input);

	if (read.kind !== "status") return { name, status };

	return {
		name,
		status,
		mac: runnerPart(read.status, RUNNERS[0], now, amberAfterSeconds),
		ci: runnerPart(read.status, RUNNERS[1], now, amberAfterSeconds),
		version: span(read.status.engine.version, "dim"),
	};
};

const bodyRow = (input: BandInput): Row => {
	const { width } = input;
	const parts = partsOf(input);
	const control = span(CONTROL, "strong", { kind: "open" });
	const room = width - cells(CONTROL) - MIN_GAP;
	const left = fitting([...shortenings(KEEP_ORDER), []].map((kept) => shown(parts, kept)), room);

	if (left === undefined) return room > 0 ? [span(ellipsize(parts.status.text, room), parts.status.tone), span(spaces(MIN_GAP), "plain"), control] : [span(ellipsize(CONTROL, width), "strong", control.press)];

	return [...left, span(spaces(width - rowCells(left) - cells(CONTROL)), "plain"), control];
};

/** The band: one padded row, the control at the right end. The status and the control stay whole from 42 cells; name, ages and version drop from the end. */
export const bandRow = (input: BandInput): Row => padded(bodyRow({ ...input, width: innerWidth(input.width) }));
