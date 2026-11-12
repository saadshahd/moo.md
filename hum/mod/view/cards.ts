import type { Card, Question } from "../../../hum-engine/src/status/format.ts";
import type { Unread } from "../../types";
import { buttonWords, displayId } from "../item.ts";
import { sinceText } from "./freshness.ts";
import { button, buttonRows } from "./buttons.ts";
import { cells, ellipsize, wrap } from "./cells.ts";
import { shortenings } from "./fit.ts";
import type { ViewInput } from "./input.ts";
import { GLYPHS, SEPARATOR } from "./glyphs.ts";
import { type Row, type Tone, span } from "./row.ts";

const RULE_LEAD = 2;
const RULE_TAIL_MIN = 2;

/** The top border with the title in it. Parts of the title drop from the end until it fits; the first part is cut last. */
const titleRule = (parts: readonly string[], width: number): Row => {
	const room = width - RULE_LEAD - RULE_TAIL_MIN - 2;
	const title = shortenings(parts).map((kept) => kept.join(SEPARATOR)).find((candidate) => cells(candidate) <= room) ?? ellipsize(parts.join(SEPARATOR), room);
	const tail = Math.max(0, width - RULE_LEAD - cells(title) - 2);

	return [span(GLYPHS.rule.repeat(RULE_LEAD), "dim"), span(` ${title} `, "strong"), span(GLYPHS.rule.repeat(tail), "dim")];
};

/** Where a card is drawn: the clock its age is read from and the width it fills. */
type CardInput = Pick<ViewInput, "now" | "width">;

const paragraph = (text: string, width: number, tone: Tone): Row[] => wrap(text, width).map((line) => [span(line, tone)]);

/** A question card: the question is never cut, only wrapped; each button fills the prompt with an answer to finish. */
export const questionCardRows = ({ item, text, options, since }: Question, { now, width }: CardInput): Row[] => [
	titleRule([displayId(item), sinceText(since, now)], width),
	...paragraph(text, width, "plain"),
	...buttonRows(
		buttonWords({ options }).map((word, index) => button(word, { kind: "fill", item, word }, index === 0)),
		width,
	),
];

const KIND_WORD: Readonly<Record<Card["kind"], string>> = { waiting: "waiting", limited: "limited", fault: "fault" };

/** A waiting, limited or fault card: the cause, then the fix in one sentence, then at most one action. */
export const noticeCardRows = ({ kind, item, code, cause, fix, action, since }: Card, { now, width }: CardInput): Row[] => [
	titleRule([displayId(item ?? code), KIND_WORD[kind], sinceText(since, now)], width),
	...paragraph(cause, width, "plain"),
	...paragraph(fix, width, "dim"),
	...(action === undefined || item === undefined ? [] : buttonRows([button(action.label, { kind: "fill", item, word: action.answer }, true)], width)),
];

/** The card for a work source the view cannot read: what the read said, wrapped whole where the band has no room for it. */
export const unreadCardRows = ({ cause, since }: Unread, { now, width }: CardInput): Row[] => [titleRule(["work source", "unread", sinceText(since, now)], width), ...paragraph(cause, width, "amber")];

export const blankRow = (): Row => [span(" ", "plain")];
