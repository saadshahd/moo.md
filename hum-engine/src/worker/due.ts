import type { Kind } from "../config/schema.ts";
import type { SavedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";

/** The delays of the timeouts the wait a saved item stands in declares, shortest first. */
const delaysOf = (kind: Kind, saved: SavedSnapshot): number[] =>
	Object.keys((saved.state && kind.machine.states[saved.state]?.after) || {})
		.map(Number)
		.sort((a, b) => a - b);

/**
 * When the owner was told of the wait an item was saved in: once the question it queued was asked, which the daily
 * cap may hold back, else when it was saved. Undefined while a question of the item still waits for room.
 */
const toldAt = (state: State, saved: SavedSnapshot): number | undefined => {
	const asked = state.questions.list().filter(({ item }) => item === saved.itemId);

	return asked.some(({ askedAt }) => askedAt === undefined) ? undefined : Math.max(saved.savedAt, ...asked.flatMap(({ askedAt }) => (askedAt === undefined ? [] : [askedAt])));
};

/** How long the saved wait has run by `t`, or undefined while it has not started; a snapshot of another machine version never runs. */
const ranFor = (state: State, kind: Kind, saved: SavedSnapshot, t: number): number | undefined => {
	const since = saved.machineVersion === kind.machine.version ? toldAt(state, saved) : undefined;

	return since === undefined ? undefined : t - since;
};

/** Whether the earliest timeout of the wait a saved item stands in has passed by `t`. */
export const isDue = (state: State, kind: Kind, saved: SavedSnapshot, t: number): boolean => {
	const ran = ranFor(state, kind, saved, t);
	const [earliest] = delaysOf(kind, saved);

	return ran !== undefined && earliest !== undefined && ran >= earliest;
};

/**
 * A clock for a restored wait. The machine schedules its timers on it, not the wall clock, and `fireDue` fires the
 * earliest of them, as many as the wait's declared delays say are due by `t`.
 */
export const dueClock = (state: State, kind: Kind, saved: SavedSnapshot, t: number) => {
	const timers: { readonly fire: () => void; readonly ms: number }[] = [];
	const clock = { setTimeout: (fire: () => void, ms: number) => timers.push({ fire, ms }), clearTimeout: () => {} };

	const fireDue = (): void => {
		const ran = ranFor(state, kind, saved, t) ?? 0;
		const dueCount = delaysOf(kind, saved).filter((delay) => ran >= delay).length;

		for (const timer of timers.toSorted((a, b) => a.ms - b.ms).slice(0, dueCount)) timer.fire();
	};

	return { clock, fireDue };
};
