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

/** Posts the answer through the repo's hum, then tells answer mode how it went. Runs past the hook's return. */
async function post($: Engine, root: string, answering: Answering): Promise<void> {
	const ran = await runHum($, root, ["answer", ...optionArgs(answering), "--", answering.item, postedText(answering)]).catch((error: Error) => ({ exitCode: -1, stderr: error.message }));
	const box = (await $.prompt.read()).text;

	await send($, ran.exitCode === 0 ? { type: "postOk", box } : { type: "postFail", cause: failureOf(ran), box });
}

/** The owner's Enter: in answer mode it posts on the item's thread and keeps the prompt from Claude. */
export async function submitted($: Engine, root: string, origin: string, text: string): Promise<Decision> {
	const after = await send($, { type: "submit", origin, text });
	const { enter, answering, say } = after.context;

	if (enter === "thread" && answering !== undefined) post($, root, answering).catch((error: Error) => $.ui.toast(`hum: ${error.message}`));

	return enter === "thread" || enter === "nowhere" ? { kind: "drop", reason: say ?? "" } : PASS;
}
