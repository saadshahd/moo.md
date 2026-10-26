// GitHub reads and writes the run side shares, through `gh` on the user's own login.
// Each takes the command runner it should use: the worker's spawns a process, a hook's is `$.process.run`.

import { parse, render, type FactoryComment, type Kind } from "./formats.ts";

export type Run = (
  argv: readonly string[],
  opts?: { cwd?: string; stdin?: string },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

/** stdout of a command that must succeed; a failure throws with its stderr. */
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

/** The issue a factory branch is for, or null for any other branch. */
export function issueOf(branch: string): number | null {
  const m = /^factory\/(\d+)$/.exec(branch.trim());
  return m ? Number(m[1]) : null;
}

export type Comment = {
  id: number;
  body: string;
  author: string;
  createdAt: string;
};

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
    ".[] | {id, body, author: .user.login, createdAt: .created_at}",
  ]);
  return out
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as Comment);
}

/** The factory comments among `cs`, each with its GitHub id. */
export function factoryComments(
  cs: readonly Comment[],
): { id: number; c: FactoryComment }[] {
  return cs.flatMap((x) => {
    const c = parse(x.body);
    return c ? [{ id: x.id, c }] : [];
  });
}

/** The newest factory comment of `kind`, or null. */
export function latest<K extends Kind>(
  cs: readonly Comment[],
  kind: K,
): { id: number; c: Extract<FactoryComment, { kind: K }> } | null {
  const found = factoryComments(cs).filter((x) => x.c.kind === kind);
  return (
    (found.at(-1) as
      { id: number; c: Extract<FactoryComment, { kind: K }> } | undefined) ??
    null
  );
}

/** Posts `c` on the issue or PR `n`, returning the new comment's id. */
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

/** Replaces comment `id`'s body with `c`. */
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
 * Posts `c`, or edits the factory comment of its kind already on `n` that `same` matches, so a
 * rerun after a crash never posts twice.
 */
export async function upsert(
  run: Run,
  repo: string,
  n: number,
  c: FactoryComment,
  same: (old: FactoryComment) => boolean = () => true,
): Promise<number> {
  const old = factoryComments(await comments(run, repo, n))
    .filter((x) => x.c.kind === c.kind && same(x.c))
    .at(-1);
  if (!old) return post(run, repo, n, c);
  await edit(run, repo, old.id, c);
  return old.id;
}

/** `owner/name` of the repo `cwd` is in, as `gh` resolves it. */
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
