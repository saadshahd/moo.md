import { issueOf, must, type Actors, type Run } from "./github.ts";
import * as z from "./vendor/zod-mini.js";

export const RULES_PATH = ".claude/factory.json";

/**
 * What only a person changes: the factory's rules, and the workflows CI runs with the repo's
 * secrets. A path ending in `/` stands for everything under it.
 */
const GUARDED = [RULES_PATH, ".github/workflows/"] as const;

/** The paths among `files` that only a person changes. */
export const guardedIn = (files: readonly string[]) =>
  files.filter((f) => GUARDED.some((g) => (g.endsWith("/") ? f.startsWith(g) : f === g)));

const Text = z.string().check(z.minLength(1));

/** A command and its arguments, run with no shell. */
const Argv = z.array(Text).check(z.minLength(1));

export const Rules = z.object({
  /** How many issues run at once on this machine. */
  atOnce: z.int().check(z.minimum(1)),
  /** Asks a day that may wait for the human; past it, the run takes its own pick and posts a call. */
  waitsPerDay: z.int().check(z.minimum(0)),
  /** Once a run's context passes this many tokens, it restarts fresh from plan, branch and handoff. */
  contextCap: z.int().check(z.minimum(1)),
  /** How often the open `/factory` pane reads GitHub again, in seconds. Default 20. */
  paneEverySeconds: z.optional(z.int().check(z.minimum(10))),
  /**
   * The factory App's bot login, `<slug>[bot]`, where the factory acts as an App: the only author
   * whose factory comments count. Without one, the factory acts as the user's own gh login.
   */
  bot: z.optional(Text.check(z.regex(/\[bot\]$/))),
  /** Whose comments, labels and issue bodies count. Default: the repo's owner. Never a bot. */
  trusted: z.optional(z.array(Text.check(z.regex(/^(?!.*\[bot\]$)/)))),
  /** Where the project's taste lives (its CLAUDE.md, a taste file), repo-relative. */
  taste: z.array(Text),
  /** Each taste rule, by the layer that enforces it; `none` lists the rules no layer takes. */
  layers: z.object({
    check: z.array(Text),
    plan: z.array(Text),
    judge: z.array(Text),
    none: z.array(Text),
  }),
  /**
   * The repo's own commands that lend a run its worktree and take it back, such as a pool of warm
   * ones. `create` gets `{name}` as `factory-<n>` and prints the worktree's path last; `release`
   * gets that path as `{dir}`. Without them, git adds each worktree beside the main one.
   */
  worktree: z.optional(z.object({ create: Argv, release: Argv })),
  /** `draft`: each PR opens as a draft that a person marks ready and merges; auto-merge is never armed. */
  pr: z.optional(z.object({ draft: z.boolean() })),
});

export type Rules = z.infer<typeof Rules>;

export function parseRules(json: string): Rules | { errors: string[] } {
  let raw: unknown;

  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { errors: [`${RULES_PATH} is not JSON: ${String(e)}`] };
  }

  const r = z.safeParse(Rules, raw);

  if (!r.success)
    return { errors: r.error.issues.map((i) => `${RULES_PATH} ${i.path.join(".") || "(root)"}: ${i.message}`) };

  /**
   * Parsing drops a key the rules don't hold; one left in the file is a field that changed or went.
   * SAFETY: `Rules` parsed `raw`, so it is an object.
   */
  const stale = Object.keys(raw as object).filter((k) => !(k in r.data));

  return stale.length === 0 ? r.data : { errors: stale.map((k) => `${RULES_PATH} ${k}: no such field`) };
}

export function actorsOf(rules: Rules, repo: string): Actors {
  return { bot: rules.bot ?? null, trusted: rules.trusted ?? [repo.split("/")[0]!] };
}

const HEAD = "refs/remotes/origin/HEAD";

/** The rules on origin's default branch, never a branch's copy: a run could edit its own. */
export async function readRules(run: Run, cwd: string): Promise<Rules> {
  const json = await must(run, ["git", "show", `${HEAD}:${RULES_PATH}`], { cwd }).catch(async (err: Error) => {
    if ((await must(run, ["git", "ls-tree", HEAD, "--", RULES_PATH], { cwd })) !== "") throw err;
    const branch = (await must(run, ["git", "symbolic-ref", "--short", HEAD], { cwd })).trim();

    throw new Error(`no ${RULES_PATH} on ${branch}; run /factory:setup`);
  });

  const r = parseRules(json);

  if ("errors" in r) throw new Error(r.errors.join("; "));

  return r;
}

const Pulls = z.array(z.object({ number: z.int(), head: z.object({ ref: z.string() }) }));

/**
 * The factory PR, from a `factory/<n>` branch, that made the newest change to the rules on
 * origin's default branch, or null when another PR or a push made it. A run writes to GitHub, as
 * the bot or the user, so a PR of its own could merge before any check of the worker's sees it.
 */
export async function rulesChangedByFactory(run: Run, cwd: string, repo: string): Promise<number | null> {
  const sha = (await must(run, ["git", "log", "-1", "--format=%H", HEAD, "--", RULES_PATH], { cwd })).trim();

  if (sha === "") return null;
  const prs = z.parse(Pulls, JSON.parse(await must(run, ["gh", "api", `repos/${repo}/commits/${sha}/pulls`])));

  return prs.find((p) => issueOf(p.head.ref) !== null)?.number ?? null;
}
