import { z } from "zod";
import type { ItemRef } from "../adapter-api.ts";
import { slug } from "../state/fs.ts";
import type { RoundupCall } from "./roundup-rpc.ts";

/** A node of roundup's Rail as hum reads it: a Workstream, or an Agent under one. */
export const RailNode = z.looseObject({
	id: z.string(),
	name: z.string(),
	kind: z.string(),
	parent: z.string().nullable().optional(),
	status: z.looseObject({ kind: z.string(), since: z.number().optional() }).nullish(),
});

export type RailNode = z.infer<typeof RailNode>;

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
