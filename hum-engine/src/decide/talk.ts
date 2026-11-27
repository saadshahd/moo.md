import { z } from "zod";

const text = z.string().min(1);

/** The work order the owner took at ideate: what to build, how they know it is done, and each rule it keeps. */
export const WorkOrder = z.strictObject({ title: text, ask: text, done: text, limits: z.array(text) });

export type WorkOrder = z.infer<typeof WorkOrder>;

/** What an ideate run answers: the order the owner took. */
export const IdeateAnswer = z.strictObject({ order: WorkOrder });

/** What a pick row answers: the option the owner picked, and what the row found or measured that the pick rests on. */
export const PickAnswer = z.strictObject({ pick: text, found: text });

/** A choice the build depends on, as shape named it: the role whose row settles it with the owner, or the pick the owner made at shape itself. */
export const BuildChoice = z.strictObject({ title: text, detail: text, role: text.optional(), pick: text.optional(), found: text.optional() });

export type BuildChoice = z.infer<typeof BuildChoice>;

/** What a shape run answers: each choice with the pick the owner made in its row, or with the role, one of `pickRoles`, whose row settles it. */
export const choicesAnswer = (pickRoles: readonly string[]) => {
	const picked = z.strictObject({ title: text, detail: text, pick: text });
	const [first, ...rest] = pickRoles;

	return z.strictObject({ choices: z.array(first === undefined ? picked : z.union([picked, z.strictObject({ title: text, detail: text, role: z.enum([first, ...rest]) })])) });
};

/** One of hum's questions and the owner's answer to it. */
export type QuestionAnswer = { readonly question: string; readonly answer: string };

/** What the owner settled: at ideate and shape, and in answers to hum's questions. */
export type Talked = { readonly order?: WorkOrder; readonly choices?: readonly BuildChoice[]; readonly answers?: readonly QuestionAnswer[] };

const orderText = ({ title, ask, done, limits }: WorkOrder): string => [`**${title}**`, `Ask: ${ask}`, `Done: ${done}`, ["Limits:", ...limits.map((limit) => `- ${limit}`)].join("\n")].join("\n\n");

const pickText = ({ title, pick, found }: BuildChoice): string => `- ${title}: ${pick === undefined ? "not picked yet" : [pick, found].filter(Boolean).join(". ")}`;

/** A question and its answer as a run reads them. */
export const answerText = ({ question, answer }: QuestionAnswer): string => `Question: ${question}\nAnswer: ${answer}`;

/** The item's words as each run reads them: the work order the owner took, the owner's pick on each choice, then the owner's answers to hum's questions. */
export const talkedBody = (body: string, { order, choices = [], answers = [] }: Talked): string =>
	[
		body,
		order && `## The work order the owner took\n\n${orderText(order)}`,
		choices.length > 0 && `## The owner's picks\n\n${choices.map(pickText).join("\n")}`,
		answers.length > 0 && `## The owner's answers\n\n${answers.map(answerText).join("\n\n")}`,
	]
		.filter(Boolean)
		.join("\n\n");
