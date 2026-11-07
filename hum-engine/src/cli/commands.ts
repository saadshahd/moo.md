/** One flag of an op: its commander spelling, and whether it may repeat. */
export type Flag = { readonly flag: string; readonly repeats?: true };

type Spec = { readonly summary: string; readonly args: string; readonly flags?: readonly Flag[] };

/** One `hum <op>`, as `hum help --json` prints it. */
export type Command = { readonly summary: string; readonly usage: string };

const specs = {
	"list-ready": { summary: "List the items ready to claim.", args: "" },
	claim: { summary: "Take an item for a holder; the first caller wins and a claim expires unless renewed.", args: "<item> <holder>", flags: [{ flag: "--ttl <seconds>" }, { flag: "--renew" }] },
	read: { summary: "Print an item with its thread.", args: "<item>" },
	comment: { summary: "Add a comment to an item's thread.", args: "<item> <text...>" },
	ask: { summary: "Put a question to the owner on an item's thread.", args: "<item> <text...>", flags: [{ flag: "--option <word>", repeats: true }] },
	answer: { summary: "Write the owner's answer into the item, commit it and push it with hooks off.", args: "<item> <text...>", flags: [{ flag: "--option <word>" }] },
	watch: { summary: "Say whether anything changed since the last watch; costs no rate limit when idle.", args: "", flags: [{ flag: "--since <token>" }] },
	"file-follow-up": { summary: "File a ready item from another item; the same title from the same item files once.", args: "<from-item> <title>", flags: [{ flag: "--body <text>" }] },
	decide: { summary: "Record a choice made without the owner.", args: "<item> <text...>" },
	publish: { summary: "Publish an item's artifact through the release integration.", args: "<item> <ref>" },
	release: { summary: "Release a published artifact through the release integration.", args: "<item> <ref>" },
	push: { summary: "Run git push with hooks off; every argument goes to git.", args: "[git push args...]" },
} as const satisfies Record<string, Spec>;

export type OpName = keyof typeof specs;

/** What commander registers for each op: the one place an op's arguments and flags are written. */
export const opSpecs: Readonly<Record<OpName, Spec>> = specs;

const usageOf = (name: string, { args, flags = [] }: Spec): string =>
	["hum", name, args, ...flags.map(({ flag, repeats }) => `[${flag}]${repeats ? "..." : ""}`)].filter(Boolean).join(" ");

/** Every `hum <op>`, keyed by its name. Roles and machines name only these. */
// SAFETY: the entries are the keys of `specs`, mapped one to one.
export const commands = Object.fromEntries(
	Object.entries(opSpecs).map(([name, spec]) => [name, { summary: spec.summary, usage: usageOf(name, spec) }]),
) as Readonly<Record<OpName, Command>>;
