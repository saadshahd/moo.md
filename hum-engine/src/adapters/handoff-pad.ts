import type { HandoffRequest, HandoffReview, OwnerHandoff } from "../adapter-api.ts";

/** The Pad that hands an item to the owner, by the name they know it: "#<id> handoff". */
export const handoffPadName = (id: string): string => `#${id} handoff`;

/** The characters of a commit git's short form shows. */
const SHORT_COMMIT = 7;

type ChangedFile = NonNullable<OwnerHandoff["files"]>[number];

export type HandoffWriting = {
	readonly id: string;
	readonly title: string;
	readonly handoff: OwnerHandoff;
	/** The question the owner answers, while the change waits on them. */
	readonly question?: string;
	/** The link to a Rail row by its name, where the row still stands. */
	readonly rowLink: (name: string) => string | undefined;
};

const code = (text: string): string => `\`${text}\``;

const listed = (files: readonly string[]): string => files.map(code).join(", ");

const either = (words: readonly string[]): string => (words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")}, or ${words.at(-1)}`);

const sentence = (text: string): string => (/[.?!]$/u.test(text.trim()) ? text.trim() : `${text.trim()}.`);

const headline = ({ id, title, handoff, question }: HandoffWriting): string =>
	`**#${id} ${title}: ${"merged" in handoff ? `merged at ${code(handoff.merged.commit.slice(0, SHORT_COMMIT))}.` : (question ?? "it waits on you.")}**`;

const decideLine = (handoff: OwnerHandoff): string =>
	"decide" in handoff ? `**Decide:** ${either([...handoff.decide.options, ...(handoff.decide.ownWords ? ["answer in your own words"] : [])])}. Answer in the question's row.` : "";

/** Why a request stands open, in what the change holds: the files it never holds, then the files it holds unchanged since the review. */
const openWhy = ({ files, untouched }: Extract<HandoffRequest, { status: "open" }>, branch: string): string => {
	const unchanged = files.filter((file) => !untouched.includes(file));

	return [untouched.length > 0 && `${listed(untouched)} ${untouched.length === 1 ? "is" : "are"} not on ${code(branch)}`, unchanged.length > 0 && `${listed(unchanged)} did not change after that review`].filter(Boolean).join("; ");
};

const requestsSection = (handoff: OwnerHandoff): string => {
	const open = handoff.reviews.flatMap(({ label, request }) => (request?.status === "open" ? [`- ${label}: ${sentence(request.text)} ${sentence(openWhy(request, handoff.branch))}`] : []));

	return [`## ${"merged" in handoff ? "Open follow-ups" : "Open requests"}`, open.length > 0 ? open.join("\n") : "None that hum can see."].join("\n\n");
};

const filesSection = ({ files }: OwnerHandoff): string => {
	if (files === undefined) return "## Changed files\n\nhum keeps no saved change for this item: read the branch.";

	const sum = (count: (file: ChangedFile) => number | undefined) => files.reduce((total, file) => total + (count(file) ?? 0), 0);
	const lines = files.map(({ path, added, removed }) => `- ${code(path)} ${added === undefined || removed === undefined ? "binary" : `+${added} -${removed}`}`);

	return [`## Changed files (${files.length}, +${sum(({ added }) => added)} -${sum(({ removed }) => removed)})`, lines.join("\n")].join("\n\n");
};

/** A review whose request hum cannot judge: listed under the review, with the files that changed since. */
const unclearLine = (request: HandoffRequest | undefined): string =>
	request?.status === "unclear"
		? `\n   It asked: ${sentence(request.text)} hum cannot tell whether the commits after it settle that: ${request.changed ? `they change ${listed(request.changed)}.` : "hum keeps no record of what changed since."}`
		: "";

const reviewLine = ({ label, event, refused, request }: HandoffReview, place: number): string =>
	`${place + 1}. ${label}: ${event}.${refused ? ` hum set this answer aside and asked again: ${sentence(refused)}` : ""}${unclearLine(request)}`;

const reviewsSection = ({ reviews }: OwnerHandoff): string => ["## Reviews", reviews.length > 0 ? reviews.map(reviewLine).join("\n") : "No review ran on this change."].join("\n\n");

const lookSection = ({ handoff, rowLink }: HandoffWriting): string => {
	const rows = handoff.rows.flatMap(({ label, name }) => {
		const link = rowLink(name);

		return link ? [`[${label}](${link})`] : [];
	});

	const where = "merged" in handoff ? `- Merged at ${code(handoff.merged.commit.slice(0, SHORT_COMMIT))}, from the branch ${code(handoff.branch)}` : `- The branch ${code(handoff.branch)}`;

	return ["## Where to look", [where, rows.length > 0 ? `- Rows: ${rows.join(" · ")}` : ""].filter(Boolean).join("\n")].join("\n\n");
};

/**
 * The handoff Pad's text, decision first: what the owner decides, or that the change merged; the review requests no
 * later commit settles; the changed files; each review's verdict; and where to look.
 */
export const handoffText = (writing: HandoffWriting): string =>
	[headline(writing), decideLine(writing.handoff), requestsSection(writing.handoff), filesSection(writing.handoff), reviewsSection(writing.handoff), lookSection(writing)].filter(Boolean).join("\n\n");
