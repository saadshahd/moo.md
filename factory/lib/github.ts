import { parse, render, writer, type FactoryComment, type Kind } from "./formats.ts";

export type Run = (
  argv: readonly string[],
  opts?: { cwd?: string; stdin?: string },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export async function must(run: Run, argv: readonly string[], opts?: Parameters<Run>[1]): Promise<string> {
  const r = await run(argv, opts);

  if (r.exitCode !== 0)
    throw new Error(`${argv.slice(0, 3).join(" ")} failed: ${r.stderr.trim()}`);

  return r.stdout;
}

/** The branch a run claims for issue `n`; the first push of it wins the issue. */
export const branchFor = (n: number) => `factory/${n}`;

/** The session name of a run for issue `n` of `repo`; agent view lists runs by it. */
export const runName = (repo: string, n: number) => `factory:${repo}#${n}`;

export function issueOf(branch: string): number | null {
  const m = /^factory\/(\d+)$/.exec(branch.trim());

  return m ? Number(m[1]) : null;
}

/** Logins in REST form: a bot is `<slug>[bot]`. `editor` is who last edited the body, if anyone. */
export type Comment = {
  id: number;
  body: string;
  author: string | null;
  editor: string | null;
  createdAt: string;
  url: string;
};

/** The factory's bot, and the people whose words count. */
export type Actors = { bot: string; trusted: readonly string[] };

/**
 * Written by one of `logins` and edited by nobody else. The bot can edit anyone's comment, so
 * an edit by anyone outside `logins` voids the comment.
 */
export function wroteIt(
  c: { author: string | null; editor: string | null },
  logins: readonly string[],
): boolean {
  return (
    c.author !== null &&
    logins.includes(c.author) &&
    (c.editor === null || logins.includes(c.editor))
  );
}

export const fromBot = (c: Comment, a: Actors) => wroteIt(c, [a.bot]);
export const fromTrusted = (c: Comment, a: Actors) => wroteIt(c, a.trusted);

/** The comments that are factory comments from the author their kind allows, oldest first. */
export function factoryComments(cs: readonly Comment[], a: Actors): { id: number; c: FactoryComment }[] {
  return cs.flatMap((x) => {
    const c = parse(x.body);

    if (c === null) return [];
    const ok = writer(c.kind) === "bot" ? fromBot(x, a) : fromTrusted(x, a);

    return ok ? [{ id: x.id, c }] : [];
  });
}

type Of<K extends Kind> = { id: number; c: Extract<FactoryComment, { kind: K }> };

export function latest<K extends Kind>(cs: readonly Comment[], a: Actors, kind: K): Of<K> | null {
  return factoryComments(cs, a).findLast((x): x is Of<K> => x.c.kind === kind) ?? null;
}

const asBody = (c: FactoryComment) => ({ stdin: JSON.stringify({ body: render(c) }) });

export async function post(run: Run, repo: string, n: number, c: FactoryComment): Promise<number> {
  const argv = ["gh", "api", `repos/${repo}/issues/${n}/comments`, "--input", "-", "--jq", ".id"];
  const out = await must(run, argv, asBody(c));

  return Number(out.trim());
}

export async function edit(run: Run, repo: string, id: number, c: FactoryComment): Promise<void> {
  const argv = ["gh", "api", "-X", "PATCH", `repos/${repo}/issues/comments/${id}`, "--input", "-", "--silent"];
  await must(run, argv, asBody(c));
}

/**
 * Posts `c` on `n`, or edits the bot's newest comment of its kind among `existing` when it
 * differs, so a rerun after a crash never posts twice. Says which it did.
 */
export async function upsert(
  run: Run,
  repo: string,
  n: number,
  c: FactoryComment,
  existing: readonly Comment[],
  a: Actors,
): Promise<"posted" | "edited" | "unchanged"> {
  const old = latest(existing, a, c.kind);

  if (old === null) {
    await post(run, repo, n, c);

    return "posted";
  }

  if (render(old.c) === render(c)) return "unchanged";
  await edit(run, repo, old.id, c);

  return "edited";
}

export async function repoOf(run: Run, cwd: string): Promise<string> {
  return (await must(run, ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { cwd })).trim();
}

export const STUCK_LABEL = "factory:stuck";

export async function markStuck(run: Run, repo: string, n: number, reason: string): Promise<void> {
  await post(run, repo, n, { kind: "stuck", issue: n, reason });
  await must(run, ["gh", "label", "create", STUCK_LABEL, "--repo", repo, "--force",
    "--color", "B60205", "--description", "A factory run gave up; the comment says why"]);
  await must(run, ["gh", "issue", "edit", String(n), "--repo", repo, "--add-label", STUCK_LABEL]);
}
