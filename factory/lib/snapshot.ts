/**
 * Everything the factory reads from GitHub in one GraphQL query: the open `factory` issues with
 * their comments, open PRs with their files, each local issue's PR, the claimed branches, undo
 * issues, recent merged PRs and the base's checks. An open factory PR whose checks have not all
 * passed costs one query more, for the ones GitHub requires. Worker and pane read the same
 * snapshot, so every machine agrees.
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

/** A check's outcome as the factory counts it: PENDING, however long it waits, never failed. */
export type CheckState = "SUCCESS" | "PENDING" | "FAILURE";

/** A check run or a commit status, by the name GitHub requires it under. */
export type Check = { name: string; state: CheckState };

const CHECK_RUN = { __typename: z.literal("CheckRun"), name: z.string(), status: z.string(), conclusion: z.nullable(z.string()) };

const STATUS_STATES = ["EXPECTED", "ERROR", "FAILURE", "PENDING", "SUCCESS"] as const;

const STATUS = { __typename: z.literal("StatusContext"), context: z.string(), state: z.literal(STATUS_STATES) };

const CheckNode = z.union([z.object(CHECK_RUN), z.object(STATUS)]);

const RequiredNode = z.union([
  z.object({ ...CHECK_RUN, isRequired: z.boolean() }),
  z.object({ ...STATUS, isRequired: z.boolean() }),
]);

const CHECK = "__typename ... on CheckRun { name status conclusion } ... on StatusContext { context state }";

const BaseChecks = z.nullable(z.object({ contexts: z.object({ pageInfo: Page, nodes: z.array(CheckNode) }) }));

/** Check run conclusions that fail; a run that finished any other way passed. */
const FAILED_RUN = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"]);

const STATUS_STATE = {
  EXPECTED: "PENDING",
  ERROR: "FAILURE",
  FAILURE: "FAILURE",
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
} as const satisfies { [S in (typeof STATUS_STATES)[number]]: CheckState };

function toCheck(c: z.infer<typeof CheckNode>): Check {
  if (c.__typename === "StatusContext") return { name: c.context, state: STATUS_STATE[c.state] };

  if (FAILED_RUN.has(c.conclusion ?? "")) return { name: c.name, state: "FAILURE" };

  return { name: c.name, state: c.status === "COMPLETED" ? "SUCCESS" : "PENDING" };
}

const WORST_FIRST = ["FAILURE", "PENDING", "SUCCESS"] as const satisfies readonly CheckState[];

/** The state of `checks` together: FAILURE once any failed, else PENDING while any waits, else SUCCESS; null for none. */
export const combined = (checks: readonly Check[]): CheckState | null =>
  WORST_FIRST.find((s) => checks.some((c) => c.state === s)) ?? null;

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

const PR_FIELDS = {
  ...MERGE_FIELDS,
  number: z.int(),
  headRefName: z.string(),
  state: z.literal(["OPEN", "CLOSED", "MERGED"]),
  closedAt: z.nullable(z.string()),
  comments: Comments,
};

const PrNode = z.object(PR_FIELDS);

const ReviewNode = z.object({
  databaseId: z.int(),
  state: z.string(),
  body: z.string(),
  author: Actor,
  commit: z.nullable(z.object({ oid: z.string() })),
  comments: z.object({
    pageInfo: Page,
    nodes: z.array(z.object({ path: z.string(), line: z.nullable(z.int()), originalLine: z.nullable(z.int()), body: z.string() })),
  }),
});

const LocalPrNode = z.object({ ...PR_FIELDS, reviews: z.object({ nodes: z.array(ReviewNode) }) });

const PR = `number headRefName state closedAt ${MERGE}
  comments(first: 100) { pageInfo { hasNextPage } nodes { ${COMMENT} } }`;

const REVIEWS = `reviews(last: 20) { nodes {
  databaseId state body author { __typename login } commit { oid }
  comments(first: 50) { pageInfo { hasNextPage } nodes { path line originalLine body } }
} }`;

const PrList = z.object({ pageInfo: Page, nodes: z.array(PrNode) });

const LocalPrList = z.object({ pageInfo: Page, nodes: z.array(LocalPrNode) });

const Data = z.object({
  data: z.object({
    repository: z.object({
      work: z.object({ pageInfo: Page, nodes: z.array(IssueNode) }),
      open: z.object({ pageInfo: Page, nodes: z.array(OpenPrNode) }),
      refs: z.object({ pageInfo: Page, nodes: z.array(z.object({ name: z.string() })) }),
      undos: z.object({ pageInfo: Page, nodes: z.array(z.object({ body: z.string(), author: Actor, editor: Actor })) }),
      merged: PrList,
      base: z.object({ name: z.string(), target: z.object({ oid: z.string(), statusCheckRollup: z.optional(BaseChecks) }) }),
    }),
  }),
});

/** The query, with one PR lookup per issue this machine has a worktree for. */
export function snapshotQuery(local: readonly number[]): string {
  const prs = local
    .map((n) => `pr${n}: pullRequests(headRefName: "${branchFor(n)}", first: 5, states: [OPEN, CLOSED, MERGED], orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage } nodes { ${PR} ${REVIEWS} }
    }`)
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
    base: defaultBranchRef {
      name target { ... on Commit { oid statusCheckRollup { contexts(first: 100) { pageInfo { hasNextPage } nodes { ${CHECK} } } } } }
    }
    merged: pullRequests(states: MERGED, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage } nodes { ${PR} }
    }
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
  /**
   * The combined state of the checks GitHub requires for the PR, on its newest commit; null when
   * it requires none, and for PRs whose checks the factory never reads: merged ones, closed ones
   * and other people's.
   */
  checks: CheckState | null;
  /** The names of those checks, read once any check on the PR has not passed. */
  required: string[];
};

export type OpenPr = Merge & {
  number: number;
  head: string;
  /** Null when the PR changes more files than one page lists: it may touch anything. */
  files: string[] | null;
};

/** A review on a PR. An inline comment's `line` is where it sits now, else where it sat when made. */
export type Review = {
  id: number;
  /** COMMENTED, CHANGES_REQUESTED, APPROVED, DISMISSED or PENDING. */
  state: string;
  body: string;
  author: string | null;
  /** The commit it was made on; null once that commit is gone. */
  commit: string | null;
  comments: { path: string; line: number | null; body: string }[];
};

export type Pr = Merge & {
  number: number;
  head: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  closedAt: string | null;
  comments: Comment[];
  /** Its newest 20 reviews, oldest first. */
  reviews: Review[];
};

export type Snapshot = {
  issues: Issue[];
  open: OpenPr[];
  /** The newest PR from each local issue's branch. */
  prs: Map<number, Pr>;
  claimed: Set<number>;
  undos: { body: string; author: string | null; editor: string | null }[];
  /** Read for their cost comments only: no reviews. */
  merged: Omit<Pr, "reviews">[];
  /** The default branch, its newest commit, and that commit's checks. */
  base: { name: string; sha: string; checks: Check[] };
  /**
   * Windows that held more than they list: undo issues past the newest 100, merged PRs past the
   * newest 50, a merged PR's comments past its first 100. Every other connection is read whole.
   */
  truncated: string[];
};

/** A PR's checks as the factory reads them; see `Merge`. */
type Checked = Pick<Merge, "checks" | "required">;

const UNREAD: Checked = { checks: null, required: [] };

const merge = (p: z.infer<typeof MergeNode>, c: Checked): Merge => ({
  mergeable: p.mergeable,
  mergeState: p.mergeStateStatus,
  headSha: p.headRefOid,
  ...c,
});

const toPr = (p: z.infer<typeof PrNode>, cs: Comment[], c: Checked): Omit<Pr, "reviews"> => ({
  ...merge(p, c),
  number: p.number,
  head: p.headRefName,
  state: p.state,
  closedAt: p.closedAt,
  comments: cs,
});

function whole(path: string, page: { hasNextPage: boolean }): void {
  if (page.hasNextPage) throw new Error(`GitHub listed only part of ${path}; the factory reads it whole or not at all`);
}

function toReview(pr: number, r: z.infer<typeof ReviewNode>): Review {
  whole(`review ${r.databaseId}'s comments on PR #${pr}`, r.comments.pageInfo);

  return {
    id: r.databaseId,
    state: r.state,
    body: r.body,
    author: login(r.author),
    commit: r.commit?.oid ?? null,
    comments: r.comments.nodes.map((c) => ({ path: c.path, line: c.line ?? c.originalLine, body: c.body })),
  };
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

const RequiredData = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        commits: z.object({
          nodes: z.array(
            z.object({
              commit: z.object({
                statusCheckRollup: z.nullable(z.object({ contexts: z.object({ pageInfo: Page, nodes: z.array(RequiredNode) }) })),
              }),
            }),
          ),
        }),
      }),
    }),
  }),
});

const REQUIRED = `query($owner: String!, $name: String!, $n: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $n) {
      commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) {
        pageInfo { hasNextPage }
        nodes { ${CHECK} ... on CheckRun { isRequired(pullRequestNumber: $n) } ... on StatusContext { isRequired(pullRequestNumber: $n) } }
      } } } } }
    }
  }
}`;

/** The checks GitHub requires for PR `n`, on its newest commit: which ones takes the PR's number, so they can't ride in the snapshot's query. */
async function requiredChecks(run: Run, repo: string, n: number): Promise<Check[]> {
  const contexts = z.parse(RequiredData, JSON.parse(await graphql(run, repo, REQUIRED, "-F", `n=${n}`))).data.repository
    .pullRequest.commits.nodes[0]?.commit.statusCheckRollup?.contexts;

  if (contexts === undefined) return [];
  whole(`PR #${n}'s checks`, contexts.pageInfo);

  return contexts.nodes.flatMap((c) => (c.isRequired ? [toCheck(c)] : []));
}

export async function readSnapshot(run: Run, repo: string, local: readonly number[]): Promise<Snapshot> {
  const raw: unknown = JSON.parse(await graphql(run, repo, snapshotQuery(local)));
  const r = z.parse(Data, raw).data.repository;
  whole("the open factory issues", r.work.pageInfo);
  whole("the open PRs", r.open.pageInfo);
  whole("the factory branches", r.refs.pageInfo);
  const baseChecks = r.base.target.statusCheckRollup?.contexts;

  if (baseChecks !== undefined) whole(`${r.base.name}'s checks`, baseChecks.pageInfo);
  const reads = new Map<number, Promise<Check[]>>();

  /**
   * An open factory PR's checks. A rollup of SUCCESS means every check passed and none means no
   * check ran, so only a PR short of both has its required checks read, once however often listed.
   */
  const checksOf = async (p: z.infer<typeof MergeNode> & { number: number; headRefName: string }, open: boolean): Promise<Checked> => {
    const rollup = p.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null;

    if (!open || issueOf(p.headRefName) === null || rollup === null) return UNREAD;

    if (rollup === "SUCCESS") return { checks: "SUCCESS", required: [] };
    const read = reads.get(p.number) ?? requiredChecks(run, repo, p.number);
    reads.set(p.number, read);
    const required = await read;

    return { checks: combined(required), required: required.map((c) => c.name) };
  };

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
      const newest = z.parse(z.object({ data: z.object({ repository: z.object({ [`pr${n}`]: LocalPrList }) }) }), raw).data
        .repository[`pr${n}`]?.nodes[0];

      if (newest === undefined) return [];
      const cs = await commentsOf(newest.number, newest.comments);
      const reviews = newest.reviews.nodes.map((r) => toReview(newest.number, r));

      return [[n, { ...toPr(newest, cs, await checksOf(newest, newest.state === "OPEN")), reviews }]];
    }),
  );

  const open = await Promise.all(
    r.open.nodes.map(async (p): Promise<OpenPr> => ({
      ...merge(p, await checksOf(p, true)),
      number: p.number,
      head: p.headRefName,
      files: p.files === null || p.files.pageInfo.hasNextPage ? null : p.files.nodes.map((f) => f.path),
    })),
  );

  return {
    issues,
    open,
    prs: new Map(prs.flat()),
    claimed: new Set(r.refs.nodes.flatMap((ref) => issueOf(`${LABEL}/${ref.name}`) ?? [])),
    undos: r.undos.nodes.map((u) => ({ body: u.body, author: login(u.author), editor: login(u.editor) })),
    merged: r.merged.nodes.map((p) => toPr(p, p.comments.nodes.map(toComment), UNREAD)),
    base: { name: r.base.name, sha: r.base.target.oid, checks: baseChecks?.nodes.map(toCheck) ?? [] },
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
