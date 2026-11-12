import type { EngineInterface } from "claude-code";
import { atom, read, update } from "claude-code";
import { failureOf, runHum } from "../press.ts";
import { answerOf } from "./fill.ts";
import type { Decision } from "./guard.ts";
import { type AnswerEvent, type AnswerSnapshot, type Answering, answerMachine, postedText } from "./machine.ts";

type Engine = EngineInterface;

/* oxlint-disable anti-slop/no-shape-in-symbol-names -- `shape` is the engine's option name for a stored value's version tag */
const mode = atom({ plugin: "hum", key: "answerMode" } as const, answerMachine.initialState, { shape: "answer-mode-1" });
/* oxlint-enable anti-slop/no-shape-in-symbol-names */

const PASS: Decision = { kind: "pass" };

/** The engine's longest wait for a command. A post still running then is stopped, and may have landed. */
const POST_LIMIT_MS = 10 * 60 * 1000;

/** Steps answer mode by one event and applies what it decided for the box and the owner's eyes. */
async function send($: Engine, event: AnswerEvent): Promise<AnswerSnapshot> {
	const after = await update($, mode, (before) => answerMachine.transition(before, event)[0]);
	const { box, say } = after.context;

	if (box.kind === "set") await $.prompt.fill({ text: box.text, mode: "replace" });

	if (say !== undefined && event.type !== "submit") $.ui.toast(say);

	return after;
}

/** The item whose thread Enter posts on, while answer mode is on. */
export async function answeringLabel($: Engine): Promise<string | undefined> {
	const now = await read($, mode);

	return now.value === "off" ? undefined : now.context.answering?.label;
}

export async function isAnswering($: Engine): Promise<boolean> {
	return (await read($, mode)).value !== "off";
}

/** A restart ends answer mode: a post in flight still lands, and the worker sees it on its next read. */
export async function restartAnswer($: Engine): Promise<void> {
	await send($, { type: "restart" });
}

/** A question's button: fills the prompt, only when it is empty. */
export async function fillAnswer($: Engine, item: string, word: string): Promise<void> {
	await send($, { type: "fill", answer: answerOf(item, word), box: (await $.prompt.read()).text });
}

export async function editedBox($: Engine, box: string): Promise<void> {
	await send($, { type: "edit", box });
}

export async function changedBox($: Engine, origin: string, box: string): Promise<void> {
	await send($, { type: "change", origin, box });
}

const optionArgs = ({ option }: Answering): string[] => (option === undefined ? [] : ["--option", option]);

/** How a post ended: the repo could not be found, hum exited 0 or not, or it never reported, so the answer may be on the thread. */
async function postEvent($: Engine, rootOf: () => Promise<string>, answering: Answering, box: () => Promise<string>): Promise<AnswerEvent> {
	const root = await rootOf().catch((error: Error) => error);

	if (root instanceof Error) return { type: "postFail", cause: root.message, box: await box() };

	const ran = await runHum($, root, ["answer", ...optionArgs(answering), "--", answering.item, postedText(answering)], { timeoutMs: POST_LIMIT_MS }).catch((error: Error) => error);

	if (ran instanceof Error) return { type: "postUnknown", cause: ran.message, box: await box() };

	return ran.exitCode === 0 ? { type: "postOk", box: await box() } : { type: "postFail", cause: failureOf(ran), box: await box() };
}

/** Posts the answer through the repo's hum, then tells answer mode how it went, so it always leaves posting. */
export async function post($: Engine, rootOf: () => Promise<string>, answering: Answering): Promise<void> {
	await send($, await postEvent($, rootOf, answering, () => $.prompt.read().then(({ text }) => text, () => "")));
}

/** What the owner's Enter decided, and the answer to post when it went to the item's thread. */
export type Submitted = { readonly decision: Decision; readonly toPost?: Answering };

/** The owner's Enter: in answer mode it goes to the item's thread and is kept from Claude. */
export async function submitted($: Engine, origin: string, text: string): Promise<Submitted> {
	const after = await send($, { type: "submit", origin, text });
	const { enter, answering, say } = after.context;
	const decision: Decision = enter === "thread" || enter === "nowhere" ? { kind: "drop", reason: say ?? "" } : PASS;

	return enter === "thread" ? { decision, toPost: answering } : { decision };
}
