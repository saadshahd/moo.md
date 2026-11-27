import { z } from "zod";
import type { ItemRef } from "../adapter-api.ts";
import { slug } from "../state/fs.ts";
import { type RoundupCall, RoundupRefusal } from "./roundup-rpc.ts";

/** A node of roundup's Rail as hum reads it: a Workstream, or an Agent under one. */
export const RailNode = z.looseObject({
	id: z.string(),
	name: z.string(),
	kind: z.string(),
	parent: z.string().nullable().optional(),
	status: z.looseObject({ kind: z.string(), since: z.number().optional() }).nullish(),
});

export type RailNode = z.infer<typeof RailNode>;

/** A Pad as hum reads it: its name and where it sits. */
const Pad = z.looseObject({ name: z.string(), home: z.string().nullish() });

export type Pad = z.infer<typeof Pad>;

/** Writes the Pad `name` whole, making it with `visibility` where none stands, and answers it as roundup holds it now and whether this call made it. */
export const putPad = async (call: RoundupCall, { name, text, visibility }: { readonly name: string; readonly text: string; readonly visibility: "shown" | "internal" }): Promise<{ readonly pad: Pad; readonly made: boolean }> => {
	const made = await call("pad.create", { name, text, visibility }).then(
		(pad) => Pad.parse(pad),
		(error: Error) => {
			if (!(error instanceof RoundupRefusal)) throw error;

			return undefined;
		},
	);

	return made ? { pad: made, made: true } : { pad: Pad.parse(await call("pad.write", { name, text })), made: false };
};

/** A link the roundup App opens, as its own links read: the page's kind, its id with every reserved character escaped, and the Project. */
const roundupLink = (kind: "agent" | "pad", id: string, projectKey: string): string =>
	`roundup://${kind}/${encodeURIComponent(id).replace(/[!'()*]/gu, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}?project=${projectKey}`;

export const agentLink = (id: string, projectKey: string): string => roundupLink("agent", id, projectKey);

export const padLink = (name: string, projectKey: string): string => roundupLink("pad", name, projectKey);

/** The status of a row that waits on the owner. */
export const NEEDS_YOU = "needs-you";

/** A row's status once it has ended, whoever ended it. */
export const ENDED = "done";

/** The longest name roundup gives a Rail row. */
const RAIL_NAME_LENGTH = 42;

/** Hex characters of the hash that keeps two long names apart once each is cut to fit. */
const NAME_HASH = 8;

const WORKSTREAM = "workstream";

/** Names past roundup's length are cut and hashed to fit a Rail row. */
export const railName = (name: string): string => (name.length <= RAIL_NAME_LENGTH ? name : `${name.slice(0, RAIL_NAME_LENGTH - NAME_HASH - 1)} ${slug(name).slice(0, NAME_HASH)}`);

/** The Workstream an item's rows sit in, "#<id> <title>". */
export const itemWorkstreamName = ({ id, title }: ItemRef): string => railName(`#${id} ${title}`);

export const railTree = async (call: RoundupCall): Promise<RailNode[]> => z.array(RailNode).parse(await call("rail.tree"));

/** The root Workstream named `name`, among `nodes`. */
export const rootWorkstream = (nodes: readonly RailNode[], name: string): RailNode | undefined => nodes.find((node) => node.kind === WORKSTREAM && !node.parent && node.name === name);

/** The id of the item's Workstream, made at the Project's root where none stands yet. */
export const itemWorkstream = async (call: RoundupCall, item: ItemRef): Promise<string> => {
	const name = itemWorkstreamName(item);

	return rootWorkstream(await railTree(call), name)?.id ?? RailNode.parse(await call("rail.createWorkstream", { name })).id;
};
