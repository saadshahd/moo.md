/**
 * Everything the factory reads from GitHub in one GraphQL query: the open `factory` issues with
 * their comments, open PRs with their files, each local issue's PR, the claimed branches, undo
 * issues and recent merged PRs. Worker and pane read the same snapshot, so every machine agrees.
 */

import { parse } from "./formats.ts";
import {
  branchFor,
  wroteIt,
  issueOf,
  must,
  type Actors,
  type Comment,
  type Run,
} from "./github.ts";
import * as z from "./vendor/zod-mini.js";

export const LABEL = "factory";

/** The label on an issue a person opened to reverse a call; the worker never picks it up. */
export const UNDO_LABEL = "factory:undo";

const Actor = z.nullable(
  z.object({ __typename: z.string(), login: z.string() }),
);

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
  labels: z.object({
    pageInfo: Page,
    nodes: z.array(z.object({ name: z.string() })),
  }),
  timelineItems: z.object({
    nodes: z.array(
      z.object({
        actor: z.optional(Actor),
        label: z.optional(z.object({ name: z.string() })),
      }),
    ),
  }),
  blockedBy: z.object({
    pageInfo: Page,
    nodes: z.array(z.object({ state: z.string() })),
  }),
  comments: z.object({ pageInfo: Page, nodes: z.array(CommentNode) }),
});

const OpenPrNode = z.object({
  number: z.int(),
  headRefName: z.string(),
  files: z.nullable(
    z.object({
      pageInfo: Page,
      nodes: z.array(z.object({ path: z.string() })),
    }),
  ),
});

const PrNode = z.object({
  number: z.int(),
  headRefName: z.string(),
  state: z.literal(["OPEN", "CLOSED", "MERGED"]),
  closedAt: z.nullable(z.string()),
  commits: z.object({
    nodes: z.array(
      z.object({
        commit: z.object({
          statusCheckRollup: z.nullable(z.object({ state: z.string() })),
        }),
      }),
    ),
  }),
  comments: z.object({ pageInfo: Page, nodes: z.array(CommentNode) }),
});

const PRS = `pageInfo { hasNextPage } nodes {
  number headRefName state closedAt
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  comments(first: 100) { pageInfo { hasNextPage } nodes { ${COMMENT} } }
}`;

const Data = z.object({
  data: z.object({
    repository: z.object({
      work: z.object({ pageInfo: Page, nodes: z.array(IssueNode) }),
      open: z.object({ pageInfo: Page, nodes: z.array(OpenPrNode) }),
      refs: z.object({
        pageInfo: Page,
        nodes: z.array(z.object({ name: z.string() })),
      }),
      undos: z.object({
        pageInfo: Page,
        nodes: z.array(
          z.object({ body: z.string(), author: Actor, editor: Actor }),
        ),
      }),
      merged: z.object({ pageInfo: Page, nodes: z.array(PrNode) }),
    }),
  }),
});

const PrList = z.object({ pageInfo: Page, nodes: z.array(PrNode) });

/** The query, with one PR lookup per issue this machine has a worktree for. */
export function snapshotQuery(local: readonly number[]): string {
  const prs = local
    .map(
      (n) =>
        `pr${n}: pullRequests(headRefName: "${branchFor(n)}", first: 5, states: [OPEN, CLOSED, MERGED], orderBy: {field: CREATED_AT, direction: DESC}) { ${PRS} }`,
    )
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
      nodes { number headRefName files(first: 100) { pageInfo { hasNextPage } nodes { path } } }
    }
    refs(refPrefix: "refs/heads/${LABEL}/", first: 100) { pageInfo { hasNextPage } nodes { name } }
    undos: issues(labels: ["${UNDO_LABEL}"], first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage }
      nodes { body author { __typename login } editor { __typename login } }
    }
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

export type OpenPr = {
  number: number;
  head: string;
  /** Null when the PR changes more files than one page lists: it may touch anything. */
  files: string[] | null;
};

export type Pr = {
  number: number;
  head: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  closedAt: string | null;
  /** The newest commit's combined check state, as GitHub names it, or null before any check. */
  checks: string | null;
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
  /**
   * Windows that held more than they list: undo issues past the newest 100, merged PRs past the
   * newest 50, a merged PR's comments past its first 100. Every other connection is read whole.
   */
  truncated: string[];
};

const toPr = (p: z.infer<typeof PrNode>, cs: Comment[]): Pr => ({
  number: p.number,
  head: p.headRefName,
  state: p.state,
  closedAt: p.closedAt,
  checks: p.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
  comments: cs,
});

function whole(path: string, page: { hasNextPage: boolean }): void {
  if (page.hasNextPage)
    throw new Error(
      `GitHub listed only part of ${path}; the factory reads it whole or not at all`,
    );
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

/** Every comment on issue or PR `n`, oldest first. */
export async function comments(
  run: Run,
  repo: string,
  n: number,
): Promise<Comment[]> {
  const [owner, name] = repo.split("/");

  const out = await must(run, [
    "gh",
    "api",
    "graphql",
    "--paginate",
    "--slurp",
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${name}`,
    "-F",
    `n=${n}`,
    "-f",
    `query=query($owner: String!, $name: String!, $n: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    issueOrPullRequest(number: $n) {
      ... on Issue { comments(first: 100, after: $endCursor) { pageInfo { hasNextPage endCursor } nodes { ${COMMENT} } } }
      ... on PullRequest { comments(first: 100, after: $endCursor) { pageInfo { hasNextPage endCursor } nodes { ${COMMENT} } } }
    }
  }
}`,
  ]);

  return z
    .parse(CommentsPage, JSON.parse(out))
    .flatMap((p) =>
      p.data.repository.issueOrPullRequest.comments.nodes.map(toComment),
    );
}

export async function readSnapshot(
  run: Run,
  repo: string,
  local: readonly number[],
): Promise<Snapshot> {
  const [owner, name] = repo.split("/");

  const raw: unknown = JSON.parse(
    await must(run, [
      "gh",
      "api",
      "graphql",
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
      "-f",
      `query=${snapshotQuery(local)}`,
    ]),
  );

  const r = z.parse(Data, raw).data.repository;
  whole("the open factory issues", r.work.pageInfo);
  whole("the open PRs", r.open.pageInfo);
  whole("the factory branches", r.refs.pageInfo);

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
        labelledBy: login(
          i.timelineItems.nodes.findLast((e) => e.label?.name === LABEL)
            ?.actor ?? null,
        ),
        blocked: i.blockedBy.nodes.some((b) => b.state === "OPEN"),
        comments: i.comments.pageInfo.hasNextPage
          ? await comments(run, repo, i.number)
          : i.comments.nodes.map(toComment),
      };
    }),
  );

  const prs = new Map(
    await Promise.all(
      local.flatMap((n) => {
        const newest = z.parse(
          z.object({ data: z.object({ repository: z.object({ [`pr${n}`]: PrList }) }) }),
          raw,
        ).data.repository[`pr${n}`]?.nodes[0];

        if (newest === undefined) return [];

        return [
          (async (): Promise<[number, Pr]> => [
            n,
            toPr(
              newest,
              newest.comments.pageInfo.hasNextPage
                ? await comments(run, repo, newest.number)
                : newest.comments.nodes.map(toComment),
            ),
          ])(),
        ];
      }),
    ),
  );

  return {
    issues,
    open: r.open.nodes.map((p) => ({
      number: p.number,
      head: p.headRefName,
      files:
        p.files === null || p.files.pageInfo.hasNextPage
          ? null
          : p.files.nodes.map((f) => f.path),
    })),
    prs,
    claimed: new Set(r.refs.nodes.flatMap((ref) => issueOf(`${LABEL}/${ref.name}`) ?? [])),
    undos: r.undos.nodes.map((u) => ({
      body: u.body,
      author: login(u.author),
      editor: login(u.editor),
    })),
    merged: r.merged.nodes.map((p) => toPr(p, p.comments.nodes.map(toComment))),
    truncated: [
      ...(r.undos.pageInfo.hasNextPage ? ["undo issues"] : []),
      ...(r.merged.pageInfo.hasNextPage ? ["merged PRs"] : []),
      ...r.merged.nodes.flatMap((p) =>
        p.comments.pageInfo.hasNextPage ? [`PR #${p.number}'s comments`] : [],
      ),
    ],
  };
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
