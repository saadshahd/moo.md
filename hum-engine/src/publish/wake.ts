import { ItemId } from "../adapter-api.ts";
import type { State } from "../state/open.ts";
import { HOUR_MS } from "../time.ts";
import { forgetProgress } from "../worker/kind.ts";
import { releaseQuestions } from "../worker/questions.ts";
import { answerTo, park, type ThinResult } from "../worker/thin-path.ts";
import { kindMoveFault, takeWorkRecords } from "./handoff.ts";
import type { Gathered, OutboxPass, ReadOutbox } from "./handover.ts";
import { fetchedPublishRepo, type Publisher, publishPass, refusedPass } from "./publisher.ts";
import { settleBaseCheck } from "../worker/base-check.ts";

/** What publish works from in a CI wake: its own root, what gather settled, the work job's outbox and its state, and how it saves its own state. */
export type PublishWake = { readonly publisher: Publisher; readonly gathered: Gathered; readonly outbox: ReadOutbox; readonly work: State; readonly save: () => Promise<void> };

/**
 * Publishes one pass of a work job: the work job's own records for the item, a kind it moved the item to only where
 * that kind is another whose risk floor is no lower, kept a fallback where publish's was one, then the pass's outbox, checked as on a Mac. The pass's result is the landing's,
 * else the work job's own, which never merges.
 */
const publishWorked = async ({ publisher: p, gathered, outbox, work }: PublishWake, pass: OutboxPass): Promise<ThinResult> => {
	const known = p.state.itemKinds.get(pass.item);
	const kind = known && p.config.kinds[known.kind];

	if (known === undefined || kind === undefined) return refusedPass(pass.item, `publish holds no kind for ${pass.item}`);

	const item = await p.workSource.read(ItemId.parse(pass.item));
	const at = p.state.items.saved().find(({ itemId }) => itemId === pass.item)?.state;
	const refused = takeWorkRecords(work, p.state, { item: pass.item, kind, at, answered: answerTo(item) !== undefined }, { now: p.now(), usageLimitMaxMs: p.config.hum.ciUsageLimitMaxHours * HOUR_MS });

	if (refused !== undefined) return refusedPass(pass.item, refused);

	if (pass.result.outcome === "moved") {
		const fault = kindMoveFault(p.config, { from: known.kind, to: pass.result.kind });

		if (fault !== undefined) return refusedPass(pass.item, fault);

		forgetProgress(p.state, pass.item);
		p.state.itemKinds.put(pass.item, known.from === "fallback" ? { ...known, kind: pass.result.kind } : { item: pass.item, kind: pass.result.kind, from: "model" });
	}

	const published = await publishPass(p, { baseSha: gathered.baseSha, heads: gathered.heads }, { item: pass.item, intents: pass.intents, bundle: outbox.bundleOf(pass) });

	return published ?? pass.result;
};

/**
 * Settles the base check the work job ran, so its breaks place every pass after it, publishes every pass of its
 * outbox in order, then asks the questions the daily cap has room for. A pass
 * that throws ends refused, and the state is saved after each pass and once more at the end however it ends, so what
 * one pass wrote is never written again.
 */
export const publishWake = async (wake: PublishWake): Promise<ThinResult[]> => {
	const { publisher: p } = wake;
	const results: ThinResult[] = [];

	try {
		const { baseCheck } = wake.outbox;

		if (baseCheck !== undefined) {
			await settleBaseCheck({ state: p.state, config: p.config, workSource: p.workSource, git: await fetchedPublishRepo(p), base: p.base, now: p.now }, baseCheck);
			await wake.save();
		}

		for (const pass of wake.outbox.passes) {
			const result = park(p, await publishWorked(wake, pass).catch((error: Error) => refusedPass(pass.item, error.message)));

			if (result.outcome === "merged") p.state.items.remove(pass.item);

			results.push(result);
			await wake.save();
		}

		await releaseQuestions({ state: p.state, config: p.config, workSource: p.workSource, questions: p.questions, now: p.now });

		return results;
	} finally {
		await wake.save();
	}
};
