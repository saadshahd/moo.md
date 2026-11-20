import * as core from "@actions/core";
import { CREDENTIAL_CHANGED } from "../adapters/claude-p.ts";
import { SIGNAL_NOT_APPLIED } from "../loop/pass.ts";
import type { Card } from "../status/format.ts";
import { PARKED_CODES } from "../worker/thin-path.ts";
import { CLAIMED_CODE, UNREAD_CODE, type Worker } from "../worker/worker.ts";
import { CARD_CODES } from "./cards.ts";

/**
 * CI wake: ticks, lets the runs it started end, and ticks again until a tick starts nothing. A CI job holds no
 * session across a wait for the owner: a run that needs them has pushed its branch, asked on the item and ended.
 * `afterTick` runs once each tick's runs have ended, so a job stopped at its time limit loses only the tick in flight.
 */
export const wakeUntilQuiet = async (worker: Pick<Worker, "tick" | "idle">, afterTick: () => Promise<void> = async () => {}): Promise<void> => {
	for (;;) {
		const result = await worker.tick();

		await worker.idle();
		await afterTick();

		if (result.kind !== "ran" || result.started.length === 0) return;
	}
};

/**
 * The cards that only inform: hum's work goes on as it would without them. A card that stops only its own item leaves
 * the other items to go on: a thread a tick could not read is read again next tick, a parked item sits out until the
 * owner acts, and an item someone else works on waits until they let it go.
 */
const INFORMING_CARDS: ReadonlySet<string> = new Set([SIGNAL_NOT_APPLIED, CARD_CODES.tokenExpiring, CREDENTIAL_CHANGED, UNREAD_CODE, CLAIMED_CODE, ...PARKED_CODES]);

/** Whether a card ends a CI wake: every card does but one that only informs. */
export const doesStopWake = ({ code }: Pick<Card, "code">): boolean => !INFORMING_CARDS.has(code);

/** The card as one line of text. */
const line = (card: Card): string => `${card.cause} ${card.fix}`;

/**
 * Shows the cards where a CI job's reader looks: an error annotation for each card that stops the wake, a warning for
 * each that only informs, and the job's step summary when the runner gives one. The job's status file dies with the
 * job, so this is the only place CI shows a card.
 */
export const reportCards = async (cards: readonly Card[], { hasStepSummary }: { readonly hasStepSummary: boolean }): Promise<void> => {
	for (const card of cards) (doesStopWake(card) ? core.error : core.warning)(line(card), { title: `hum ${card.code}` });

	if (hasStepSummary && cards.length > 0) await core.summary.addHeading("hum", 2).addList(cards.map((card) => `${card.code}: ${line(card)}`)).write();
};
