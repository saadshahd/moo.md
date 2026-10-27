import { must, type Actors, type Run } from "./github.ts";
import * as z from "./vendor/zod-mini.js";

export const RULES_PATH = ".claude/factory.json";

const Text = z.string().check(z.minLength(1));

export const Rules = z.object({
  /** How many issues run at once on this machine. */
  atOnce: z.int().check(z.minimum(1)),
  /** Asks a day that may wait for the human; past it, the run takes its own pick and posts a call. */
  waitsPerDay: z.int().check(z.minimum(0)),
  /** Once a run's context passes this many tokens, it restarts fresh from plan, branch and handoff. */
  contextCap: z.int().check(z.minimum(1)),
  /** How often the open `/factory` pane reads GitHub again, in seconds. Default 20. */
  paneEverySeconds: z.optional(z.int().check(z.minimum(10))),
  /** The factory App's bot login, `<slug>[bot]`: the only author whose factory comments count. */
  bot: Text.check(z.regex(/\[bot\]$/)),
  /** Whose comments, labels and issue bodies count. Default: the repo's owner. Never the bot. */
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

  return r.success
    ? r.data
    : {
        errors: r.error.issues.map((i) => `${RULES_PATH} ${i.path.join(".") || "(root)"}: ${i.message}`),
      };
}

export function actorsOf(rules: Rules, repo: string): Actors {
  return { bot: rules.bot, trusted: rules.trusted ?? [repo.split("/")[0]!] };
}

/** The rules on origin's default branch, never a branch's copy: a run could edit its own. */
export async function readRules(run: Run, cwd: string): Promise<Rules> {
  const r = parseRules(await must(run, ["git", "show", `refs/remotes/origin/HEAD:${RULES_PATH}`], { cwd }));

  if ("errors" in r) throw new Error(r.errors.join("; "));

  return r;
}
