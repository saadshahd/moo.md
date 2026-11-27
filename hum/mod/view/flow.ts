import type { Controls, OpenItem, Question } from "../../../hum-engine/src/status/format.ts";
import { FREE_ANSWER } from "../item.ts";
import { button, buttonRows } from "./buttons.ts";
import { type Labeled, questionButtons } from "./cards.ts";
import { cells, ellipsize, rowCells, spaces, wrap } from "./cells.ts";
import { fitting } from "./fit.ts";
import { sinceText } from "./freshness.ts";
import { GLYPHS, SEPARATOR } from "./glyphs.ts";
import type { ViewInput } from "./input.ts";
import { runRows } from "./links.ts";
import { listRows } from "./lists.ts";
import { type NotePick, type Request, type Row, type Span, span } from "./row.ts";

type Step = OpenItem["steps"][number];

/** What an item's flow is drawn from: the clock, the width, the rows the owner unfolded, and the question the item asks, where one is open. */
export type FlowInput = Pick<ViewInput, "now" | "width"> & { readonly unfolded: ReadonlySet<string>; readonly question?: Question };

/** Where the card stands on the rail: the step, absent in a condition the item fell into before passing any, and what the condition says. */
type Place = { readonly step?: string; readonly condition?: string };

const RAIL = spaces(2);

/** The cells a card's frame takes from its width: a side and a cell of padding at each side. */
const FRAME_CELLS = 4;

const PICK_GAP = 2;

/** What a Select draws around its value: its label and a colon before it, its mark after it. */
const pickText = (label: string, value: string): string => `${label}: ${value} ▾`;

const SAYS = { noteTo: "note to", askingYou: "asking you", waitsOnYou: "waits on you" } as const;

/** Each request the owner may make at a step, the control that allows it there and its button's label, in the order the card draws them. */
const REQUEST_BUTTONS = [
	{ request: "run-now", allowedBy: "runNow", label: "run now" },
	{ request: "skip", allowedBy: "skip", label: "skip" },
] as const satisfies readonly { readonly request: Request; readonly allowedBy: keyof Controls; readonly label: string }[];

/** The rail draws the steps and the end; routes and conditions never. */
const isOnRail = ({ part }: Step): boolean => part === "step" || part === "end";

/** At a step the card stands there; in a condition, at the last step the item passed, saying the condition. */
const placeOf = ({ steps, at }: OpenItem, passed: readonly string[]): Place => {
	const now = steps.find(({ name }) => name === at);

	if (now === undefined || isOnRail(now)) return { step: at };

	return { step: passed.at(-1), condition: now.waitsOnOwner ? SAYS.askingYou : at };
};

/** The steps the item passed, folded into one line that a press unfolds into a line each; a press on any folds them back. */
const passedRows = (passed: readonly string[], { foldId, isUnfolded, width }: { readonly foldId: string; readonly isUnfolded: boolean; readonly width: number }): Row[] => {
	const press = { kind: "fold", id: foldId } as const;
	const mark = `${GLYPHS.passed} `;
	const room = (tail: string): number => width - cells(RAIL) - cells(mark) - cells(tail);
	const line = (text: string, tail: string): Row => [span(RAIL), span(mark, "success"), span(`${ellipsize(text, room(tail))}${tail}`, "dim", press)];

	if (passed.length === 0) return [];

	if (!isUnfolded) return [line(passed.join(SEPARATOR), ` ${GLYPHS.unfold}`)];

	return passed.map((name, index) => line(name, index === passed.length - 1 ? ` ${GLYPHS.fold}` : ""));
};

/** A step ahead: its name, and that the item will wait on the owner there; the end is quiet. */
const aheadRow = ({ name, part, waitsOnOwner }: Step, width: number): Row => {
	const lead = [span(RAIL), span(`${GLYPHS.ahead} `, "dim")];
	const room = width - rowCells(lead);
	const tone = part === "end" ? "dim" : "plain";
	const waits = waitsOnOwner ? [[span(name, tone), span(`  ${SAYS.waitsOnYou}`, "dim")]] : [];

	return [...lead, ...(fitting(waits, room) ?? [span(ellipsize(name, room), tone)])];
};

/** The card's top edge, with the step, its condition and its age in it; the age drops first, then the condition, then the step is cut. */
const topEdge = ({ step, condition }: Place, age: string, width: number): Row => {
	const lead = [span(`${GLYPHS.frame.topLeft}${GLYPHS.rule} `, "accent"), span(`${GLYPHS.now} `, "accent")];
	const named = step === undefined ? [] : [span(step, "strong")];
	const said = condition === undefined ? [] : [span(step === undefined ? condition : ` ${GLYPHS.separator} ${condition}`, "amber")];
	const aged = [span(`  ${age}`, "dim")];
	const tailMin = cells(` ${GLYPHS.rule}${GLYPHS.frame.topRight}`);
	const room = width - rowCells(lead) - tailMin;
	const title = fitting([[...named, ...said, ...aged], [...named, ...said], named, said], room) ?? [span(ellipsize(step ?? condition ?? "", room), "strong")];
	const tail = width - rowCells(lead) - rowCells(title) - cells(GLYPHS.frame.topRight) - 1;

	return [...lead, ...title, span(` ${GLYPHS.rule.repeat(Math.max(1, tail))}${GLYPHS.frame.topRight}`, "accent")];
};

const bottomEdge = (width: number): Row => [span(`${GLYPHS.frame.bottomLeft}${GLYPHS.rule.repeat(Math.max(0, width - 2))}${GLYPHS.frame.bottomRight}`, "accent")];

/** A row inside the frame: its side, then the row filled to the inner width, then the other side. */
const framed = (row: Row, inner: number): Row => [span(`${GLYPHS.frame.side} `, "accent"), ...row, span(spaces(inner - rowCells(row))), span(` ${GLYPHS.frame.side}`, "accent")];

/**
 * How the owner answers at the step: in the roundup row that asks, through its one open button; else the open
 * question's options where it has some, or each choice of the step the engine gives an answer word; then a written
 * answer where the step or a question without options takes one.
 */
const answerButtons = ({ item, controls }: OpenItem, question: Question | undefined): Labeled[] => {
	if (question?.row !== undefined) return questionButtons(question);

	const fill = (label: string, word: string): Labeled => ({ label, press: { kind: "fill", item, word } });
	const picks = question !== undefined && question.options.length > 0 ? question.options.map((option) => fill(option, option)) : controls.choices.flatMap(({ label, answer }) => (answer === undefined ? [] : [fill(label, answer)]));
	const isWritten = controls.answer || (question !== undefined && question.options.length === 0);

	return isWritten ? [...picks, fill(FREE_ANSWER, FREE_ANSWER)] : picks;
};

const requestButtons = ({ item, at, controls }: OpenItem): Labeled[] =>
	REQUEST_BUTTONS.flatMap(({ request, allowedBy, label }) => (controls[allowedBy] ? [{ label, press: { kind: "request", request, item, step: at } }] : []));

/** The room the note picker takes: as wide as it draws its widest step, so the row keeps its place as the pick moves. */
const pickSpan = (pick: NotePick, inner: number): Span => {
	const widest = pick.steps.reduce((kept, step) => (cells(step) > cells(kept) ? step : kept), "");

	return { ...span(ellipsize(pickText(pick.label, widest), inner), "accent"), pick };
};

/** The controls: buttons right-aligned, the main one first and filled; the note picker at the left of their first row, or on a row of its own where they leave no room. */
const controlRows = (item: OpenItem, question: Question | undefined, inner: number): Row[] => {
	const labeled = [...answerButtons(item, question), ...requestButtons(item)];
	const rows = buttonRows(labeled.map(({ label, press }, index) => button({ label, press, isPrimary: index === 0 })), inner);
	const { noteTo } = item.controls;

	if (noteTo.length === 0) return rows;

	const pick = pickSpan({ label: SAYS.noteTo, item: item.item, steps: noteTo }, inner);
	const [first, ...rest] = rows;
	const lead = first === undefined ? 0 : cells(first[0]?.text ?? "");

	if (first !== undefined && lead >= cells(pick.text) + PICK_GAP) return [[pick, span(spaces(lead - cells(pick.text))), ...first.slice(1)], ...rest];

	return [[pick, span(spaces(inner - cells(pick.text)))], ...rows];
};

/** The step now, as a bordered card on the rail: the open question, then the controls. */
const cardRows = (item: OpenItem, place: Place, { now, width, question }: FlowInput): Row[] => {
	const outer = width - cells(RAIL);
	const inner = Math.max(1, outer - FRAME_CELLS);
	const asked = question === undefined ? [] : wrap(question.text, inner).map((line): Row => [span(line)]);
	const body = [...asked, ...controlRows(item, question, inner)].map((row) => framed(row, inner));

	return [topEdge(place, sinceText(item.since, now), outer), ...body, bottomEdge(outer)].map((row): Row => [span(RAIL), ...row]);
};

/**
 * An open item as a rail: its title line, whose press shows its runs; the steps it passed, folded into one line; the
 * step now as a card with the owner's controls; then the steps ahead in the flow's order. Routes and conditions are
 * never rows: a condition is said on the card, which stands at the last step the item passed.
 */
export const flowRows = (item: OpenItem, input: FlowInput): Row[] => {
	const rail = item.steps.filter(isOnRail);
	const names = rail.map(({ name }) => name);
	const passed = (item.passed ?? []).filter((name) => names.includes(name));
	const place = placeOf(item, passed);
	const index = place.step === undefined ? -1 : names.indexOf(place.step);
	const titleId = `flow:${item.item}`;
	const passedId = `passed:${item.item}`;

	return [
		...listRows({ foldId: titleId, item: item.item, title: item.title ?? "", meta: [span(item.kind, "dim")], below: runRows(item.item, item.rows ?? [], input.width) }, { isUnfolded: input.unfolded.has(titleId), width: input.width }),
		...passedRows(passed.filter((name) => name !== place.step), { foldId: passedId, isUnfolded: input.unfolded.has(passedId), width: input.width }),
		...cardRows(item, place, input),
		...(index < 0 ? [] : rail.slice(index + 1)).map((step) => aheadRow(step, input.width)),
	];
};
