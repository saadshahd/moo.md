
import { parse, render, type FactoryComment, type Kind } from "./formats.ts";

export type Run = (
  argv: readonly string[],
  opts?: { cwd?: string; stdin?: string },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export async function must(
  run: Run,
  argv: readonly string[],
  opts?: { cwd?: string; stdin?: string },
): Promise<string> {
  const r = await run(argv, opts);

  if (r.exitCode !== 0)
    throw new Error(`${argv.slice(0, 3).join(" ")} failed: ${r.stderr.trim()}`);

  return r.stdout;
}

/** The branch a run claims for issue `n`; the first push of it wins the issue. */
export const branchFor = (n: number) => `factory/${n}`;

export function issueOf(branch: string): number | null {
  const m = /^factory\/(\d+)$/.exec(branch.trim());

  return m ? Number(m[1]) : null;
}

export type Comment = {
  id: number;
  body: string;
  author: string;
  createdAt: string;
  /** The author's tie to the repo as GitHub reports it: OWNER, MEMBER, COLLABORATOR, NONE, … */
  association: string;
};

export function trusted(c: Comment): boolean {
  /**
   * A bot is never trusted: the factory's runs post as its bot, and a run must not approve itself.
   */
  return (
    !c.author.endsWith("[bot]") &&
    ["OWNER", "MEMBER", "COLLABORATOR"].includes(c.association)
  );
}

/** Every comment on the issue, oldest first. */
export async function comments(
  run: Run,
  repo: string,
  issue: number,
): Promise<Comment[]> {
  const out = await must(run, [
    "gh",
    "api",
    "--paginate",
    `repos/${repo}/issues/${issue}/comments?per_page=100`,
    "--jq",
    ".[] | {id, body, author: .user.login, createdAt: .created_at, association: .author_association}",
  ]);

  /** SAFETY: the --jq above emits exactly Comment's fields, one object per line. */
  return out
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as Comment);
}

export function factoryComments(
  cs: readonly Comment[],
): { id: number; c: FactoryComment }[] {
  return cs.flatMap((x) => {
    const c = parse(x.body);

    return c ? [{ id: x.id, c }] : [];
  });
}

export function latest<K extends Kind>(
  cs: readonly Comment[],
  kind: K,
): { id: number; c: Extract<FactoryComment, { kind: K }> } | null {
  return (
    factoryComments(cs)
      .filter(
        (x): x is { id: number; c: Extract<FactoryComment, { kind: K }> } =>
          x.c.kind === kind,
      )
      .at(-1) ?? null
  );
}

export async function post(
  run: Run,
  repo: string,
  n: number,
  c: FactoryComment,
): Promise<number> {
  const out = await must(
    run,
    [
      "gh",
      "api",
      `repos/${repo}/issues/${n}/comments`,
      "--input",
      "-",
      "--jq",
      ".id",
    ],
    { stdin: JSON.stringify({ body: render(c) }) },
  );

  return Number(out.trim());
}

export async function edit(
  run: Run,
  repo: string,
  id: number,
  c: FactoryComment,
): Promise<void> {
  await must(
    run,
    [
      "gh",
      "api",
      "-X",
      "PATCH",
      `repos/${repo}/issues/comments/${id}`,
      "--input",
      "-",
      "--silent",
    ],
    { stdin: JSON.stringify({ body: render(c) }) },
  );
}

/**
 * Posts `c`, or edits the newest factory comment of its kind already on `n` when it differs, so
 * a rerun after a crash never posts twice.
 */
export async function upsert(
  run: Run,
  repo: string,
  n: number,
  c: FactoryComment,
): Promise<number> {
  const body = render(c);

  const old = (await comments(run, repo, n))
    .filter((x) => parse(x.body)?.kind === c.kind)
    .at(-1);

  if (!old) return post(run, repo, n, c);

  if (old.body !== body) await edit(run, repo, old.id, c);

  return old.id;
}

export async function repoOf(run: Run, cwd: string): Promise<string> {
  return (
    await must(
      run,
      [
        "gh",
        "repo",
        "view",
        "--json",
        "nameWithOwner",
        "--jq",
        ".nameWithOwner",
      ],
      { cwd },
    )
  ).trim();
}

export async function openPrFiles(
  run: Run,
  repo: string,
  ownHead: string,
): Promise<Map<number, string[]>> {
  const out = await must(run, [
    "gh",
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    "100",
    "--json",
    "number,headRefName,files",
  ]);

  /** SAFETY: gh prints JSON with exactly the --json fields asked for, typed here. */
  const prs = JSON.parse(out) as {
    number: number;
    headRefName: string;
    files: { path: string }[];
  }[];

  return new Map(
    prs.flatMap((p) =>
      p.headRefName === ownHead ? [] : [[p.number, p.files.map((f) => f.path)]],
    ),
  );
}

export async function prFrom(
  run: Run,
  repo: string,
  head: string,
): Promise<number | null> {
  const out = await must(run, [
    "gh",
    "pr",
    "list",
    "--repo",
    repo,
    "--head",
    head,
    "--state",
    "all",
    "--json",
    "number",
    "--jq",
    ".[0].number // empty",
  ]);

  return out.trim() === "" ? null : Number(out.trim());
}

export const STUCK_LABEL = "factory:stuck";

export async function markStuck(
  run: Run,
  repo: string,
  n: number,
  reason: string,
): Promise<void> {
  await post(run, repo, n, { kind: "stuck", issue: n, reason });
  await must(run, [
    "gh",
    "label",
    "create",
    STUCK_LABEL,
    "--repo",
    repo,
    "--force",
    "--color",
    "B60205",
    "--description",
    "A factory run gave up; the comment says why",
  ]);
  await must(run, ["gh", "issue", "edit", String(n), "--repo", repo, "--add-label", STUCK_LABEL]);
}

export type Bot = { token: string; expiresAt: string; name: string; email: string };

/**
 * Environment that makes `gh`, `git push` and `git commit` act as the factory's bot: `GH_TOKEN`
 * for `gh`, a git credential helper that hands git the same token in place of the user's keychain
 * login, and the bot as the commits' author.
 */
export function botEnv(bot: Bot) {
  return {
    GH_TOKEN: bot.token,
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: "",
    GIT_CONFIG_KEY_1: "credential.helper",
    GIT_CONFIG_VALUE_1: "!gh auth git-credential",
    GIT_AUTHOR_NAME: bot.name,
    GIT_AUTHOR_EMAIL: bot.email,
    GIT_COMMITTER_NAME: bot.name,
    GIT_COMMITTER_EMAIL: bot.email,
  };
}
