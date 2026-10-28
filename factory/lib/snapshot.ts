/**
 * Everything the factory reads from GitHub in one GraphQL query: the open `factory` issues with
 * their comments, open PRs with their files, each local issue's PR, the claimed branches, undo
 * issues and recent merged PRs. Worker and pane read the same snapshot, so every machine agrees.
 */

import { parse } from "./formats.ts";
import { branchFor, wroteIt, issueOf, must, type Actors, type Comment, type Run } from "./github.ts";
import * as z from "./vendor/zod-mini.js";

export const LABEL = "factory";

/** The label on an issue a person opened to reverse a call; the worker never picks it up. */
export const UNDO_LABEL = "factory:undo";

const Actor = z.nullable(z.object({ __typename: z.string(), login: z.string() }));

/** GraphQL names a bot by its slug; REST, git and the rules file say `<slug>[bot]`. */
const login = (a: z.infer<typeof Actor>) =>
  a === null ? null : a.__typename === "Bot" ? `${a.login}[bot]` : a.login;

const Page = z.object({ hasNextPage: z.boolean() });

const CommentNode = z.object({
  databaseId: z.int(),
  body: z.string(),
  url: z.string(),
  createdAt: z.string(),
  author: Actor,
  editor: Actor,
});

const Comments = z.object({ pageInfo: Page, nodes: z.array(CommentNode) });

const COMMENT =
  "databaseId body url createdAt author { __typename login } editor { __typename login }";

const toComment = (c: z.infer<typeof CommentNode>): Comment => ({
  id: c.databaseId,
  body: c.body,
  url: c.url,
  createdAt: c.createdAt,
  author: login(c.author),
  editor: login(c.editor),
});

const IssueNode = z.object({
  number: z.int(),
  title: z.string(),
  url: z.string(),
  body: z.string(),
  author: Actor,
  editor: Actor,
  labels: z.object({ pageInfo: Page, nodes: z.array(z.object({ name: z.string() })) }),
  timelineItems: z.object({
    nodes: z.array(
      z.object({
        actor: z.optional(Actor),
        label: z.optional(z.object({ name: z.string() })),
      }),
    ),
  }),
  blockedBy: z.object({ pageInfo: Page, nodes: z.array(z.object({ state: z.string() })) }),
  comments: Comments,
});

const Rollup = z.nullable(z.object({ state: z.string() }));

const MERGE_FIELDS = {
  mergeable: z.literal(["MERGEABLE", "CONFLICTING", "UNKNOWN"]),
  mergeStateStatus: z.string(),
  headRefOid: z.string(),
  commits: z.object({ nodes: z.array(z.object({ commit: z.object({ statusCheckRollup: Rollup }) })) }),
};

const MergeNode = z.object(MERGE_FIELDS);

const MERGE = "mergeable mergeStateStatus headRefOid commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }";

const OpenPrNode = z.object({
  ...MERGE_FIELDS,
  number: z.int(),
  headRefName: z.string(),
  files: z.nullable(z.object({ pageInfo: Page, nodes: z.array(z.object({ path: z.string() })) })),
});

const PrNode = z.object({
  ...MERGE_FIELDS,
  number: z.int(),
  headRefName: z.string(),
  state: z.literal(["OPEN", "CLOSED", "MERGED"]),
  closedAt: z.nullable(z.string()),
  comments: Comments,
});

const PRS = `pageInfo { hasNextPage } nodes {
  number headRefName state closedAt ${MERGE}
  comments(first: 100) { pageInfo { hasNextPage } nodes { ${COMMENT} } }
}`;

const PrList = z.object({ pageInfo: Page, nodes: z.array(PrNode) });

const Data = z.object({
  data: z.object({
    repository: z.object({
      work: z.object({ pageInfo: Page, nodes: z.array(IssueNode) }),
      open: z.object({ pageInfo: Page, nodes: z.array(OpenPrNode) }),
      refs: z.object({ pageInfo: Page, nodes: z.array(z.object({ name: z.string() })) }),
      undos: z.object({ pageInfo: Page, nodes: z.array(z.object({ body: z.string(), author: Actor, editor: Actor })) }),
      merged: PrList,
      base: z.object({ name: z.string(), target: z.object({ statusCheckRollup: z.optional(Rollup) }) }),
    }),
  }),
});

/** The query, with one PR lookup per issue this machine has a worktree for. */
export function snapshotQuery(local: readonly number[]): string {
  const prs = local
    .map((n) => `pr${n}: pullRequests(headRefName: "${branchFor(n)}", first: 5, states: [OPEN, CLOSED, MERGED], orderBy: {field: CREATED_AT, direction: DESC}) { ${PRS} }`)
    .join("\n");

  return `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    work: issues(labels: ["${LABEL}"], states: OPEN, first: 100) {
      pageInfo { hasNextPage }
      nodes {
        number title url body
        author { __typename login } editor { __typename login }
        labels(first: 20) { pageInfo { hasNextPage } nodes { name } }
        timelineItems(itemTypes: [LABELED_EVENT], last: 50) {
          nodes { ... on LabeledEvent { actor { __typename login } label { name } } }
        }
        blockedBy(first: 50) { pageInfo { hasNextPage } nodes { state } }
        comments(first: 100) { pageInfo { hasNextPage } nodes { ${COMMENT} } }
      }
    }
    open: pullRequests(states: OPEN, first: 100) {
      pageInfo { hasNextPage }
      nodes { number headRefName ${MERGE} files(first: 100) { pageInfo { hasNextPage } nodes { path } } }
    }
    refs(refPrefix: "refs/heads/${LABEL}/", first: 100) { pageInfo { hasNextPage } nodes { name } }
    undos: issues(labels: ["${UNDO_LABEL}"], first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage }
      nodes { body author { __typename login } editor { __typename login } }
    }
    base: defaultBranchRef { name target { ... on Commit { statusCheckRollup { state } } } }
    merged: pullRequests(states: MERGED, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) { ${PRS} }
    ${prs}
  }
}`;
}

export type Issue = {
  number: number;
  title: string;
  url: string;
  body: string;
  author: string | null;
  editor: string | null;
  labels: string[];
  /** Who last added the `factory` label. */
  labelledBy: string | null;
  /** An issue it depends on is still open. */
  blocked: boolean;
  comments: Comment[];
};

/** Whether GitHub can merge a PR as it stands, as GitHub names it; UNKNOWN until it has worked it out. */
export type Merge = {
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  /** `mergeStateStatus`: BEHIND, DIRTY, BLOCKED, CLEAN, UNKNOWN and the rest. */
  mergeState: string;
  headSha: string;
  /** The newest commit's combined check state, as GitHub names it, or null before any check. */
  checks: string | null;
};

export type OpenPr = Merge & {
  number: number;
  head: string;
  /** Null when the PR changes more files than one page lists: it may touch anything. */
  files: string[] | null;
};

export type Pr = Merge & {
  number: number;
  head: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  closedAt: string | null;
  comments: Comment[];
};

export type Snapshot = {
  issues: Issue[];
  open: OpenPr[];
  /** The newest PR from each local issue's branch. */
  prs: Map<number, Pr>;
  claimed: Set<number>;
  undos: { body: string; author: string | null; editor: string | null }[];
  merged: Pr[];
  /** The default branch, and its newest commit's combined check state. */
  base: { name: string; checks: string | null };
  /**
   * Windows that held more than they list: undo issues past the newest 100, merged PRs past the
   * newest 50, a merged PR's comments past its first 100. Every other connection is read whole.
   */
  truncated: string[];
};

const merge = (p: z.infer<typeof MergeNode>): Merge => ({
  mergeable: p.mergeable,
  mergeState: p.mergeStateStatus,
  headSha: p.headRefOid,
  checks: p.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
});

const toPr = (p: z.infer<typeof PrNode>, cs: Comment[]): Pr => ({
  ...merge(p),
  number: p.number,
  head: p.headRefName,
  state: p.state,
  closedAt: p.closedAt,
  comments: cs,
});

function whole(path: string, page: { hasNextPage: boolean }): void {
  if (page.hasNextPage) throw new Error(`GitHub listed only part of ${path}; the factory reads it whole or not at all`);
}

const CommentsPage = z.array(
  z.object({
    data: z.object({
      repository: z.object({
        issueOrPullRequest: z.object({
          comments: z.object({ nodes: z.array(CommentNode) }),
        }),
      }),
    }),
  }),
);

async function graphql(run: Run, repo: string, query: string, ...more: string[]): Promise<string> {
  const [owner, name] = repo.split("/");

  return must(run, ["gh", "api", "graphql", ...more, "-F", `owner=${owner}`, "-F", `name=${name}`,
    "-f", `query=${query}`]);
}

/** Every comment on issue or PR `n`, oldest first. */
export async function comments(run: Run, repo: string, n: number): Promise<Comment[]> {
  const page = `comments(first: 100, after: $endCursor) { pageInfo { hasNextPage endCursor } nodes { ${COMMENT} } }`;

  const out = await graphql(
    run,
    repo,
    `query($owner: String!, $name: String!, $n: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    issueOrPullRequest(number: $n) { ... on Issue { ${page} } ... on PullRequest { ${page} } }
  }
}`,
    "--paginate", "--slurp", "-F", `n=${n}`,
  );

  return z
    .parse(CommentsPage, JSON.parse(out))
    .flatMap((p) => p.data.repository.issueOrPullRequest.comments.nodes.map(toComment));
}

export async function readSnapshot(run: Run, repo: string, local: readonly number[]): Promise<Snapshot> {
  const raw: unknown = JSON.parse(await graphql(run, repo, snapshotQuery(local)));
  const r = z.parse(Data, raw).data.repository;
  whole("the open factory issues", r.work.pageInfo);
  whole("the open PRs", r.open.pageInfo);
  whole("the factory branches", r.refs.pageInfo);

  /** The first page of `n`'s comments when it holds them all, else every page. */
  const commentsOf = async (n: number, page: z.infer<typeof Comments>) =>
    page.pageInfo.hasNextPage ? comments(run, repo, n) : page.nodes.map(toComment);

  const issues = await Promise.all(
    r.work.nodes.map(async (i): Promise<Issue> => {
      whole(`#${i.number}'s labels`, i.labels.pageInfo);
      whole(`#${i.number}'s blockers`, i.blockedBy.pageInfo);

      return {
        number: i.number,
        title: i.title,
        url: i.url,
        body: i.body,
        author: login(i.author),
        editor: login(i.editor),
        labels: i.labels.nodes.map((l) => l.name),
        labelledBy: login(i.timelineItems.nodes.findLast((e) => e.label?.name === LABEL)?.actor ?? null),
        blocked: i.blockedBy.nodes.some((b) => b.state === "OPEN"),
        comments: await commentsOf(i.number, i.comments),
      };
    }),
  );

  const prs = await Promise.all(
    local.map(async (n): Promise<[number, Pr][]> => {
      const newest = z.parse(z.object({ data: z.object({ repository: z.object({ [`pr${n}`]: PrList }) }) }), raw).data
        .repository[`pr${n}`]?.nodes[0];

      return newest === undefined ? [] : [[n, toPr(newest, await commentsOf(newest.number, newest.comments))]];
    }),
  );

  return {
    issues,
    open: r.open.nodes.map((p) => ({
      ...merge(p),
      number: p.number,
      head: p.headRefName,
      files: p.files === null || p.files.pageInfo.hasNextPage ? null : p.files.nodes.map((f) => f.path),
    })),
    prs: new Map(prs.flat()),
    claimed: new Set(r.refs.nodes.flatMap((ref) => issueOf(`${LABEL}/${ref.name}`) ?? [])),
    undos: r.undos.nodes.map((u) => ({ body: u.body, author: login(u.author), editor: login(u.editor) })),
    merged: r.merged.nodes.map((p) => toPr(p, p.comments.nodes.map(toComment))),
    base: { name: r.base.name, checks: r.base.target.statusCheckRollup?.state ?? null },
    truncated: [
      ...(r.undos.pageInfo.hasNextPage ? ["undo issues"] : []),
      ...(r.merged.pageInfo.hasNextPage ? ["merged PRs"] : []),
      ...r.merged.nodes.flatMap((p) => (p.comments.pageInfo.hasNextPage ? [`PR #${p.number}'s comments`] : [])),
    ],
  };
}

/** The issue was labelled by a trusted person, and its body written or last edited by one. */
export function trustedIssue(i: Issue, a: Actors): boolean {
  return i.labelledBy !== null && a.trusted.includes(i.labelledBy) && wroteIt(i, a.trusted);
}

/** The call comments trusted people opened an undo issue for. */
export function undone(s: Snapshot, a: Actors): Set<number> {
  return new Set(
    s.undos.flatMap((u) => {
      const f = parse(u.body);

      return f?.kind === "undo" && wroteIt(u, a.trusted) ? [f.call] : [];
    }),
  );
}
