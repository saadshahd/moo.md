import { z } from "zod";
import type { ItemRef } from "../adapter-api.ts";
import { slug } from "../state/fs.ts";
import type { ItemLinks, ItemRow, PadLink } from "../status/format.ts";
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

/** roundup's JSON-RPC code for a call whose Todo, Pad or Agent does not exist. */
export const NOT_FOUND = -32001;

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

/** A Pad as `pad.read` answers it, with its text. */
const PadRead = Pad.extend({ text: z.string() });

/** The Pad `name` as roundup holds it, or undefined where none stands. */
export const readPad = async (call: RoundupCall, name: string): Promise<z.infer<typeof PadRead> | undefined> =>
	call("pad.read", { name }).then(
		(pad) => PadRead.parse(pad),
		(error: Error) => {
			if (error instanceof RoundupRefusal && error.code === NOT_FOUND) return undefined;

			throw error;
		},
	);

/** The Pad `name` with its link, where it stands. */
export const padLinkOf = async (call: RoundupCall, name: string, projectKey: string): Promise<PadLink | undefined> => ((await readPad(call, name)) === undefined ? undefined : { name, link: padLink(name, projectKey) });

/** The status of a row that waits on the owner. */
export const NEEDS_YOU = "needs-you";

/** A row's status once it has ended, whoever ended it. */
export const ENDED = "done";

/** The longest name roundup gives a Rail row. */
const RAIL_NAME_LENGTH = 42;

/** Hex characters of the hash that keeps two long names apart once each is cut to fit. */
const NAME_HASH = 8;

const WORKSTREAM = "workstream";

const AGENT = "agent";

/** Names past roundup's length are cut and hashed to fit a Rail row. */
export const railName = (name: string): string => (name.length <= RAIL_NAME_LENGTH ? name : `${name.slice(0, RAIL_NAME_LENGTH - NAME_HASH - 1)} ${slug(name).slice(0, NAME_HASH)}`);

/** The Workstream an item's rows sit in, "#<id> <title>". */
export const itemWorkstreamName = ({ id, title }: ItemRef): string => railName(`#${id} ${title}`);

const askPrefix = (id: string): string => `hum ${id} ask `;

/** The name of the row a question of the item's asks the owner in, the `count`th it asked. */
export const askName = (id: string, count: number): string => `${askPrefix(id)}${count}`;

/** The name of the item's feed row, an idle session whose hum pane shows the item alone. */
export const feedName = (id: string): string => railName(`hum ${id} feed`);

/** The variable a feed row's session holds its item's id in, so its hum pane shows that item alone. */
export const FEED_ITEM_ENV = "HUM_FEED_ITEM";

const Ping = z.looseObject({ projectKey: z.string() });

/** The key of the Project roundup serves, which every link into the roundup App names. */
export const projectKeyOf = async (call: RoundupCall): Promise<string> => Ping.parse(await call("daemon.ping")).projectKey;

export const railTree = async (call: RoundupCall): Promise<RailNode[]> => z.array(RailNode).parse(await call("rail.tree"));

/** The root Workstream named `name`, among `nodes`. */
export const rootWorkstream = (nodes: readonly RailNode[], name: string): RailNode | undefined => nodes.find((node) => node.kind === WORKSTREAM && !node.parent && node.name === name);

/** The item's own Workstream, "#<id> …", at the Project's root. */
export const isItemWorkstream = (id: string | number, node: RailNode): boolean => node.kind === WORKSTREAM && !node.parent && node.name.startsWith(`#${id} `);

/**
 * The Agent rows of the item's Workstream among `nodes`, in the Rail's order, each with the link that opens it, but for
 * the item's feed row, which shows them; and the row of its newest question, the newest live one where one is live.
 */
export const itemRows = (nodes: readonly RailNode[], id: string, projectKey: string): Omit<ItemLinks, "handoff"> => {
	const home = nodes.find((node) => isItemWorkstream(id, node));

	if (home === undefined) return { rows: [] };

	const rows = nodes.flatMap((node): ItemRow[] => (node.kind === AGENT && node.parent === home.id && node.name !== feedName(id) ? [{ name: node.name, agent: node.id, state: node.status?.kind ?? "unknown", link: agentLink(node.id, projectKey) }] : []));
	const asks = rows.filter(({ name }) => name.startsWith(askPrefix(id)));

	return { rows, ask: asks.findLast(({ state }) => state !== ENDED) ?? asks.at(-1) };
};

/** The id of the item's Workstream, whatever title it was made under, made at the Project's root where none stands yet. */
export const itemWorkstream = async (call: RoundupCall, item: ItemRef): Promise<string> =>
	(await railTree(call)).find((node) => isItemWorkstream(item.id, node))?.id ?? RailNode.parse(await call("rail.createWorkstream", { name: itemWorkstreamName(item) })).id;
