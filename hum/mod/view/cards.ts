import type { Card, Question } from "../../../hum-engine/src/status/format.ts";
import type { Unread } from "../../types";
import { buttonWords, displayId } from "../item.ts";
import { sinceText } from "./freshness.ts";
import { button, buttonRows } from "./buttons.ts";
import { cells, ellipsize, wrap } from "./cells.ts";
import { shortenings } from "./fit.ts";
import type { ViewInput } from "./input.ts";
import { GLYPHS, SEPARATOR } from "./glyphs.ts";
import { dismissalsOf } from "./faults.ts";
import { type Press, type Row, type Tone, span } from "./row.ts";

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
		buttonWords({ options }).map((word, index) => button({ label: word, press: { kind: "fill", item, word }, isPrimary: index === 0 })),
		width,
	),
];

type Labeled = { readonly label: string; readonly press: Press };

type Notice = { readonly title: readonly string[]; readonly cause: string; readonly fix: string; readonly buttons: readonly Labeled[] };

/** A notice: the cause, then the fix in one sentence, then its buttons, the first filled. */
const noticeRows = ({ title, cause, fix, buttons }: Notice, { width }: CardInput): Row[] => [
	titleRule(title, width),
	...paragraph(cause, width, "plain"),
	...paragraph(fix, width, "dim"),
	...buttonRows(
		buttons.map(({ label, press }, index) => button({ label, press, isPrimary: index === 0 })),
		width,
	),
];

/** Where a card was raised: its item, or its code where it names none. */
const placeOf = ({ item, code }: Card): string => displayId(item ?? code);

const actionButtons = ({ item, action }: Card): Labeled[] => (action === undefined || item === undefined ? [] : [{ label: action.label, press: { kind: "fill", item, word: action.answer } }]);

/** A waiting or limited card, with at most one action. */
export const noticeCardRows = (card: Card, input: CardInput): Row[] =>
	noticeRows({ title: [placeOf(card), card.kind, sinceText(card.since, input.now)], cause: card.cause, fix: card.fix, buttons: actionButtons(card) }, input);

const DISMISS = "Dismiss";

/** One fault card for every place a code hit: the places in the title, then the earliest card's age, cause and fix. A card of one place keeps its action; every fault card can be dismissed. */
export const faultCardRows = (group: readonly Card[], input: CardInput): Row[] => {
	const earliest = group.reduce((kept, card) => (card.since < kept.since ? card : kept));

	return noticeRows(
		{
			title: [group.map(placeOf).join(", "), earliest.kind, sinceText(earliest.since, input.now)],
			cause: earliest.cause,
			fix: earliest.fix,
			buttons: [...(group.length === 1 ? actionButtons(earliest) : []), { label: DISMISS, press: { kind: "dismiss", cards: dismissalsOf(group) } }],
		},
		input,
	);
};

/** The card for a work source the view cannot read: what the read said, wrapped whole where the band has no room for it. */
export const unreadCardRows = ({ cause, since }: Unread, { now, width }: CardInput): Row[] => [titleRule(["work source", "unread", sinceText(since, now)], width), ...paragraph(cause, width, "amber")];

export const blankRow = (): Row => [span(" ", "plain")];
