import { watch } from "node:fs";
import { dirname } from "node:path";
import { readStatus, type StatusRead } from "../status/file.ts";

/** A program status report (OSC 7501, rev 0.4): the state roundup shows on the program's row, and its label. */
export type ProgramStatus = { readonly state: "idle" | "working" | "error"; readonly msg: string };

/** The most characters of a label roundup shows; hum cuts a longer one itself. */
const LABEL_CHARS = 200;

const CONTROLS = /\p{Cc}+/gu;

const ESC = "\x1b";

const andMore = (count: number): string => (count > 1 ? ` and ${count - 1} more` : "");

/** What hum's status file says to the owner in one line: a fault first, then the items in flight, else nothing to do. */
export const programStatus = (read: StatusRead): ProgramStatus => {
	if (!read.ok) return read.reason === "missing" ? { state: "idle", msg: "" } : { state: "error", msg: read.message };

	const faults = read.status.cards.filter(({ kind }) => kind === "fault").toSorted((a, b) => b.since - a.since);
	const [fault] = faults;

	if (fault) return { state: "error", msg: `${fault.cause}${andMore(faults.length)}` };

	const running = read.status.open.filter((open) => open.running);
	const [item] = running;

	if (item) return { state: "working", msg: `#${item.item}${item.title === undefined ? "" : ` ${item.title}`}: ${item.at}${andMore(running.length)}` };

	return { state: "idle", msg: "no item in flight" };
};

const oneLine = (text: string): string => {
	const chars = [...text.replace(CONTROLS, " ").trim()];

	return chars.length > LABEL_CHARS ? `${chars.slice(0, LABEL_CHARS - 1).join("")}…` : chars.join("");
};

/** `status` as the OSC 7501 report of hum's one record: its state, hum's name, and its label in base64 when it has one. */
export const statusReport = ({ state, msg }: ProgramStatus): string => {
	const label = oneLine(msg);
	const pairs = [`state=${state}`, "app=hum", ...(label === "" ? [] : [`msg=${Buffer.from(label).toString("base64")}`])];

	return `${ESC}]7501;${pairs.join(":")}${ESC}\\`;
};

/**
 * Writes the report of the status file at `statusPath` now and each time the report changes, until the returned
 * function stops it. Any change in the file's folder is a cue to read it, as an atomic write names only its temp file.
 */
export const reportStatus = (statusPath: string, write: (report: string) => void): (() => void) => {
	let last = "";

	const look = (): void => {
		const report = statusReport(programStatus(readStatus(statusPath)));

		if (report === last) return;

		last = report;
		write(report);
	};

	const watcher = watch(dirname(statusPath), look);

	look();

	return () => watcher.close();
};
