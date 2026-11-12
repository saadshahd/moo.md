import pMemoize from "p-memoize";
import { z } from "zod";
import type { RawComment } from "./notes.ts";

/** What the reads need of a GitHub client: one REST call. */
export type Requester = { readonly request: (route: string, params?: Readonly<Record<string, string | number>>) => Promise<{ readonly data: unknown }> };

const PAGE_SIZE = 100;
const BOT = "Bot";

const ReviewComment = z.object({
	id: z.number(),
	user: z.object({ login: z.string(), type: z.string() }).nullable(),
	body: z.string(),
	commit_id: z.string(),
	path: z.string().optional(),
	line: z.number().nullable().optional(),
	diff_hunk: z.string().optional(),
	created_at: z.string(),
});

const Jobs = z.object({ jobs: z.array(z.object({ id: z.number() })) });
const Runs = z.object({ workflow_runs: z.array(z.object({ id: z.number() })) });

const pagesOf = async <T>(read: (page: number) => Promise<T[]>): Promise<T[]> => {
	const all: T[] = [];

	for (let page = 1; ; page++) {
		const found = await read(page);

		all.push(...found);

		if (found.length < PAGE_SIZE) return all;
	}
};

/** Every pull request review comment on the repo since a time, as raw comments. */
const reviewComments = async (client: Requester, repo: string, since: number): Promise<RawComment[]> =>
	(
		await pagesOf(async (page) =>
			z.array(ReviewComment).parse((await client.request(`GET /repos/${repo}/pulls/comments`, { per_page: PAGE_SIZE, page, since: new Date(since).toISOString(), sort: "created", direction: "asc" })).data),
		)
	).map((found) => ({
		kind: "comment",
		id: String(found.id),
		author: found.user?.login ?? "",
		isBot: found.user?.type === BOT,
		body: found.body,
		commit: found.commit_id,
		file: found.path,
		line: found.line ?? undefined,
		hunk: found.diff_hunk,
		at: Date.parse(found.created_at),
	}));

/** The logs of the newest runs on the base branch that started after a time, one text per job. */
const ciLogsOf =
	(client: Requester, repo: string, base: string, runsRead: number) =>
	async (since: number): Promise<string[]> => {
		const { workflow_runs: runs } = Runs.parse((await client.request(`GET /repos/${repo}/actions/runs`, { branch: base, per_page: runsRead, created: `>=${new Date(since).toISOString()}` })).data);

		return (
			await Promise.all(
				runs.map(async ({ id }) => {
					const { jobs } = Jobs.parse((await client.request(`GET /repos/${repo}/actions/runs/${id}/jobs`)).data);

					return Promise.all(jobs.map(async (job) => String((await client.request(`GET /repos/${repo}/actions/jobs/${job.id}/logs`)).data)));
				}),
			)
		).flat(2);
	};

/** The reads of a repo on GitHub, connected on first use with the owner's own login. */
export const githubLoopReads = (repo: string, base: string, runsRead: number, connect: () => Promise<Requester>) => {
	const connected = pMemoize(connect);

	return {
		comments: async (since: number) => reviewComments(await connected(), repo, since),
		ciLogs: async (since: number) => ciLogsOf(await connected(), repo, base, runsRead)(since),
	};
};
