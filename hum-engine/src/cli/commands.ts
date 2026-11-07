/** One `hum <op>`, as `hum help --json` prints it. */
export type Command = { readonly summary: string; readonly usage: string };

/** Every `hum <op>`, keyed by its name. Roles and machines name only these. */
export const commands = {
	"list-ready": { summary: "List the items ready to claim.", usage: "hum list-ready" },
	claim: { summary: "Take an item for a holder; the first caller wins and a claim expires unless renewed.", usage: "hum claim <item> <holder> [--ttl <seconds>] [--renew]" },
	read: { summary: "Print an item with its thread.", usage: "hum read <item>" },
	comment: { summary: "Add a comment to an item's thread.", usage: "hum comment <item> <text...>" },
	ask: { summary: "Put a question to the owner on an item's thread.", usage: "hum ask <item> <text...> [--option <word>]..." },
	answer: { summary: "Write the owner's answer into the item, commit it and push it with hooks off.", usage: "hum answer <item> <text...> [--option <word>]" },
	watch: { summary: "Say whether anything changed since the last watch; costs no rate limit when idle.", usage: "hum watch [--since <token>]" },
	"file-follow-up": { summary: "File a ready item from another item; the same title from the same item files once.", usage: "hum file-follow-up <from-item> <title> [--body <text>]" },
	decide: { summary: "Record a choice made without the owner.", usage: "hum decide <item> <text...>" },
	publish: { summary: "Publish an item's artifact through the release integration.", usage: "hum publish <item> <ref>" },
	release: { summary: "Release a published artifact through the release integration.", usage: "hum release <item> <ref>" },
	push: { summary: "Run git push with hooks off; every argument goes to git.", usage: "hum push [git push args...]" },
} as const satisfies Record<string, Command>;

export type OpName = keyof typeof commands;

export const isOp = (name: string | undefined): name is OpName => name !== undefined && Object.hasOwn(commands, name);
