import { stringWidth, stripAnsi } from "../vendor/libs.js";
import { GLYPHS } from "./glyphs.ts";
import type { Row } from "./row.ts";

const CONTROLS = /\p{Cc}+/gu;

/** What a terminal draws for `text`: no escape sequences, and each run of control characters, newlines and tabs one space. */
export const plain = (text: string): string => stripAnsi(text).replace(CONTROLS, " ");

/** The width of what `text` draws, so a tool's own words with a newline or a colour code in them measure as they show. */
export const cells = (text: string): number => stringWidth(plain(text));

export const rowCells = (row: Row): number => row.reduce((total, { text }) => total + cells(text), 0);

const segmenter = new Intl.Segmenter();

const graphemes = (text: string): string[] => Array.from(segmenter.segment(text), ({ segment }) => segment);

/** The longest start of `text` that fits `width` cells, always at a character boundary and never empty for a non-empty text. */
const clip = (text: string, width: number): string => {
	const [first = "", ...rest] = graphemes(plain(text));
	let taken = first;
	let used = cells(first);

	for (const next of rest) {
		used += cells(next);

		if (used > width) break;

		taken += next;
	}

	return taken;
};

export const spaces = (count: number): string => " ".repeat(Math.max(0, count));

/** `text` whole when it fits, else cut so its last cell is the ellipsis. */
export const ellipsize = (text: string, width: number): string => (cells(text) <= width ? plain(text) : `${clip(text, width - cells(GLYPHS.ellipsis))}${GLYPHS.ellipsis}`);

/** Words wrap at spaces; a word longer than the line splits at character boundaries. Nothing is dropped and nothing is added. */
export const wrap = (text: string, width: number): string[] => {
	const lines: string[] = [];
	let line = "";

	const flush = (): void => {
		if (line !== "") lines.push(line);

		line = "";
	};

	for (const word of plain(text).split(" ").filter((part) => part !== "")) {
		let rest = word;

		while (cells(rest) > width) {
			const head = clip(rest, width);

			flush();
			lines.push(head);
			rest = rest.slice(head.length);
		}

		if (line === "") line = rest;
		else if (cells(`${line} ${rest}`) <= width) line = `${line} ${rest}`;
		else {
			flush();
			line = rest;
		}
	}

	flush();

	return lines;
};
