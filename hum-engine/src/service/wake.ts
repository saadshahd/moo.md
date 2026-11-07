import { appendFileSync } from "node:fs";
import type { Card } from "../status/format.ts";
import type { Worker } from "../worker/worker.ts";

/**
 * CI wake: ticks, lets the runs it started end, and ticks again until a tick starts nothing. A CI job holds no
 * session across a wait for the owner (Q2): a run that needs them has pushed its branch, asked on the item and ended.
 */
export const wakeUntilQuiet = async (worker: Worker): Promise<void> => {
	for (;;) {
		const result = await worker.tick();

		await worker.idle();

		if (result.kind !== "ran" || result.started.length === 0) return;
	}
};

/** The card as one line of text. */
const line = (card: Card): string => `${card.cause} ${card.fix}`;

/**
 * Shows the cards where a CI job's reader looks: one error annotation each, and the job's step summary when the
 * runner gives one. The job's status file dies with the job, so this is the only place CI shows a card.
 */
export const reportCards = (cards: readonly Card[], write: (text: string) => void, summaryPath = process.env.GITHUB_STEP_SUMMARY): void => {
	for (const card of cards) write(`::error title=hum ${card.code}::${line(card).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")}\n`);

	if (summaryPath && cards.length > 0) appendFileSync(summaryPath, `## hum\n\n${cards.map((card) => `- **${card.code}**: ${line(card)}`).join("\n")}\n`);
};
