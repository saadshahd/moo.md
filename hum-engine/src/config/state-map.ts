import { type AnyActorLogic, machineVersions } from "xstate";
import { z } from "zod";
import { Json } from "./json.ts";
import type { Config } from "./load.ts";
import { kindMachine } from "./machine.ts";
import type { Kind } from "./schema.ts";

/** A work item saved in a state of a kind. */
export type SavedItem = { readonly kind: string; readonly state: string };

/** Where a saved state goes under the new kind: itself, its mapped name, or nowhere. */
const mappedState = (previous: Kind, next: Kind, state: string): string | undefined => {
	if (state in next.machine.states) return state;
	const to = next.stateMap?.[previous.machine.version]?.[state];

	return to !== undefined && to in next.machine.states ? to : undefined;
};

/** The saved items whose state the new config neither keeps nor maps. */
export const unmappedItems = (current: Config, next: Config, saved: readonly SavedItem[]): SavedItem[] =>
	saved.filter(({ kind, state }) => {
		const previous = current.kinds[kind];
		const target = next.kinds[kind];

		return previous !== undefined && (target === undefined || mappedState(previous, target, state) === undefined);
	});

/** The parts of a persisted machine snapshot the state map touches; the rest passes through. */
const Persisted = z
	.object({
		value: z.string(),
		timers: z.array(z.object({ event: z.object({ stateId: z.string().optional() }).catchall(Json) }).catchall(Json)).optional(),
	})
	.catchall(Json);

/** Timer events name `machine.state`; swap the state name at the tail. */
const renameTail = (id: string | undefined, from: string, to: string) =>
	id?.endsWith(`.${from}`) ? `${id.slice(0, -from.length)}${to}` : id;

/**
 * Moves a persisted item snapshot from one version of a kind's machine to the next,
 * through the kind's state map. The result restores with `restoreActor`.
 * Throws when the state has no home: check `unmappedItems` first.
 */
export const migrateSnapshot = async (
	previous: Kind,
	next: Kind,
	persisted: Json,
	sources: Readonly<Record<string, AnyActorLogic>> = {},
): Promise<Json> => {
	const migrate = (snapshot: z.infer<typeof Persisted>) => {
		const home = mappedState(previous, next, snapshot.value);

		if (home === undefined) throw new Error(`state "${snapshot.value}" has no home in version ${next.machine.version}`);

		return {
			...snapshot,
			value: home,
			timers: snapshot.timers?.map((timer) => ({
				...timer,
				event: { ...timer.event, stateId: renameTail(timer.event.stateId, snapshot.value, home) },
			})),
		};
	};

	// SAFETY: the machines come from JSON, so xstate's snapshot types are erased; Persisted parses the shape and the target machine's schema validates the result.
	const versions = machineVersions([kindMachine(previous, sources), kindMachine(next, sources)] as never);

	// SAFETY: same erased xstate types; the target machine's snapshot schema validates the migrated result.
	const migrated = await versions.migrateSnapshot(persisted as never, {
		to: next.machine.version,
		migrations: { [previous.machine.version]: (snapshot: Json) => migrate(Persisted.parse(snapshot)) },
	} as never);

	return Json.parse(migrated);
};
