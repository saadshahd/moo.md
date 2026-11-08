import type { Card, Question } from "../../../hum-engine/src/status/format.ts";
import { buttonWords } from "../answer/fill.ts";
import { ageSeconds, ageText } from "./freshness.ts";
import { button, buttonRows } from "./buttons.ts";
import { cells, ellipsize, wrap } from "./cells.ts";
import { GLYPHS, SEPARATOR } from "./glyphs.ts";
import { type Row, type Tone, span } from "./row.ts";

const ITEM_ID = /^\d+$/;

/** A numeric item id reads as an issue number. */
export const displayId = (item: string): string => (ITEM_ID.test(item) ? `#${item}` : item);

const RULE_LEAD = 2;
const RULE_TAIL_MIN = 2;

/** The top border with the title in it. Parts of the title drop from the end until it fits; the first part is cut last. */
const titleRule = (parts: readonly string[], width: number): Row => {
	const room = width - RULE_LEAD - RULE_TAIL_MIN - 2;
	const fitting = parts.map((_, index) => parts.slice(0, parts.length - index).join(SEPARATOR)).find((title) => cells(title) <= room);
	const title = fitting ?? ellipsize(parts.join(SEPARATOR), room);
	const tail = width - RULE_LEAD - cells(title) - 2;

	return [span(GLYPHS.rule.repeat(RULE_LEAD), "dim"), span(` ${title} `, "strong"), span(GLYPHS.rule.repeat(tail), "dim")];
};

const paragraph = (text: string, width: number, tone: Tone): Row[] => wrap(text, width).map((line) => [span(line, tone)]);

/** A question card: the question is never cut, only wrapped; each button fills the prompt with an answer to finish. */
export const questionCardRows = ({ item, text, options, since }: Question, now: number, width: number): Row[] => [
	titleRule([displayId(item), ageText(ageSeconds(since, now))], width),
	...paragraph(text, width, "plain"),
	...buttonRows(
		buttonWords({ options }).map((word, index) => button(word, { kind: "fill", item, word }, index === 0)),
		width,
	),
];

const KIND_WORD: Readonly<Record<Card["kind"], string>> = { waiting: "waiting", limited: "limited", fault: "fault" };

/** A waiting, limited or fault card: the cause, then the fix in one sentence, then at most one action. */
export const noticeCardRows = ({ kind, item, code, cause, fix, action, since }: Card, now: number, width: number): Row[] => [
	titleRule([displayId(item ?? code), KIND_WORD[kind], ageText(ageSeconds(since, now))], width),
	...paragraph(cause, width, "plain"),
	...paragraph(fix, width, "dim"),
	...(action === undefined || item === undefined ? [] : buttonRows([button(action.label, { kind: "fill", item, word: action.answer }, true)], width)),
];

export const blankRow = (): Row => [span(" ", "plain")];
