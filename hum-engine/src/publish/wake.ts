import { ItemId } from "../adapter-api.ts";
import type { State } from "../state/open.ts";
import { HOUR_MS } from "../time.ts";
import { forgetProgress } from "../worker/kind.ts";
import { releaseQuestions } from "../worker/questions.ts";
import { answerTo, park, type ThinResult } from "../worker/thin-path.ts";
import { kindMoveFault, takeWorkRecords } from "./handoff.ts";
import type { Gathered, OutboxPass, ReadOutbox } from "./handover.ts";
import { type Publisher, publishPass, refusedPass } from "./publisher.ts";

/** What publish works from in a CI wake: its own root, what gather settled, the work job's outbox and its state. */
export type PublishWake = { readonly publisher: Publisher; readonly gathered: Gathered; readonly outbox: ReadOutbox; readonly work: State };

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

/** Publishes every pass of a work job's outbox in order, then asks the questions the daily cap has room for. */
export const publishWake = async (wake: PublishWake): Promise<ThinResult[]> => {
	const { publisher: p } = wake;
	const results: ThinResult[] = [];

	for (const pass of wake.outbox.passes) {
		const result = park(p, await publishWorked(wake, pass));

		if (result.outcome === "merged") p.state.items.remove(pass.item);

		results.push(result);
	}

	await releaseQuestions({ state: p.state, config: p.config, workSource: p.workSource, questions: p.questions, now: p.now });

	return results;
};
