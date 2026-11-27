import { z } from "zod";
import { Json } from "./json.ts";
import { ANSWERED, OWNER_APPROVED, OWNER_REJECTED } from "./machine.ts";
import { type Interaction, Kind } from "./schema.ts";

/** The tag an earlier engine marked an owner wait with, before a wait named its controls in `meta.interaction`. */
const OWNER_WAIT_TAG = "owner-wait";

const APPROVE_LABEL = "Approve";

/** The parts of a state an earlier owner wait is read from; the rest passes through. */
const EarlierState = z.looseObject({
	description: z.string().optional(),
	tags: z.array(z.string()).optional(),
	on: z.record(z.string(), Json).optional(),
	meta: z.looseObject({ interaction: Json.optional() }).optional(),
});

type EarlierState = z.infer<typeof EarlierState>;

const EarlierKind = z.looseObject({ machine: z.looseObject({ states: z.record(z.string(), EarlierState) }) });

/** A state an earlier engine read as an owner wait, by the tag or by the approval it takes, that names no interaction. */
const isEarlierOwnerWait = ({ tags, on, meta }: EarlierState): boolean => meta?.interaction === undefined && (tags?.includes(OWNER_WAIT_TAG) === true || on?.[OWNER_APPROVED] !== undefined);

/** The event a written answer sent the wait: the answer where it takes one, else the rejection of the change it waits to approve. */
const textEventOf = (on: EarlierState["on"] = {}): string | undefined => [ANSWERED, OWNER_REJECTED].find((event) => on[event] !== undefined);

/** What an earlier owner wait offered, as an interaction: its approval where it took one, and the event a written answer sent. */
const interactionOf = (state: string, node: EarlierState): Interaction => {
	const interaction: Interaction = { label: node.description || state };
	const textEvent = textEventOf(node.on);

	if (node.on?.[OWNER_APPROVED] !== undefined) interaction.choices = [{ label: APPROVE_LABEL, event: { type: OWNER_APPROVED } }];

	if (textEvent !== undefined) interaction.textEvent = textEvent;

	return interaction;
};

const migrateState = (state: string, node: EarlierState): EarlierState => {
	if (!isEarlierOwnerWait(node)) return node;

	const { tags, ...rest } = node;
	const kept = tags?.filter((tag) => tag !== OWNER_WAIT_TAG) ?? [];
	const migrated: EarlierState = { ...rest, meta: { ...node.meta, interaction: interactionOf(state, node) } };

	if (kept.length > 0) migrated.tags = kept;

	return migrated;
};

/** The kind with each earlier owner wait moved to `meta.interaction`, its version kept: owners version their own machines, so the shape marks an old copy. */
const migrateKind = (earlier: z.infer<typeof EarlierKind>): z.infer<typeof EarlierKind> => ({
	...earlier,
	machine: { ...earlier.machine, states: Object.fromEntries(Object.entries(earlier.machine.states).map(([state, node]) => [state, migrateState(state, node)])) },
});

/** Every read of a kind file, the owner's and the earlier kinds kept in the state folder alike. Anything not kind-shaped goes on for the schema to refuse. */
export const KindFile = z.preprocess((raw) => {
	const earlier = EarlierKind.safeParse(raw);

	return earlier.success ? migrateKind(earlier.data) : raw;
}, Kind);
