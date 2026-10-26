/**
 * What a factory run calls to write to GitHub, so every factory comment has one shape and is
 * posted once. Run inside the run's worktree: the branch names the issue. `usage` renders each
 * command for the run's prompt from the same options `parseArgs` reads.
 */

import { parseArgs } from "node:util";
import { messageOf } from "../lib/errors.ts";
import { WHY_MAX, type Plan } from "../lib/formats.ts";
import {
  branchFor,
  factoryComments,
  issueOf,
  latest,
  markStuck,
  must,
  post,
  repoOf,
  upsert,
  type Actors,
} from "../lib/github.ts";
import {
  HANDOFF_PATH,
  PLAN_PATH,
  overlap,
  planFiles,
  planGaps,
  planText,
} from "../lib/plan.ts";
import { actorsOf, readRules, RULES_PATH } from "../lib/rules.ts";
import { comments, LABEL, readSnapshot } from "../lib/snapshot.ts";
import { approved, APPROVAL_QUESTION, APPROVE } from "../lib/wait.ts";
import { botFor, readApp } from "./app.ts";
import { run } from "./proc.ts";

class Refusal extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

export function seal(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

type Here = { cwd: string; issue: number; repo: string; actors: Actors };

async function here(cwd: string): Promise<Here> {
  const issue = issueOf(
    await must(run, ["git", "branch", "--show-current"], { cwd }),
  );

  if (issue === null) throw new Refusal("not on a factory/<n> branch", 2);
  const repo = await repoOf(run, cwd);

  return {
    cwd,
    issue,
    repo,
    actors: actorsOf(await readRules(run, cwd), repo),
  };
}

async function read(cwd: string, path: string): Promise<string> {
  const f = Bun.file(`${cwd}/${path}`);

  if (!(await f.exists()))
    throw new Refusal(`${path} does not exist; write it first`, 2);

  return f.text();
}

async function plan(h: Here): Promise<string> {
  const text = planText(await read(h.cwd, PLAN_PATH));
  const gaps = planGaps(text);

  if (gaps.length > 0)
    throw new Refusal(
      `the plan lacks: ${gaps.join(", ")}. Fill each and run plan again.`,
      2,
    );
  const files = planFiles(text);
  const open = (await readSnapshot(run, h.repo, [])).open;

  for (const pr of open) {
    if (pr.head === branchFor(h.issue)) continue;
    const both = pr.files === null ? files : overlap(files, pr.files);

    if (both.length > 0)
      throw new Refusal(
        `the plan touches ${both.join(", ")}, which open PR #${pr.number} also changes. Stop: the factory takes this issue again after #${pr.number} merges.`,
        3,
      );
  }

  const cs = await comments(run, h.repo, h.issue);
  const next: Plan = { kind: "plan", issue: h.issue, seal: seal(text), text };
  await upsert(run, h.repo, h.issue, next, cs, h.actors);

  return approved(cs, h.actors, next.seal)
    ? `plan ${next.seal.slice(0, 8)} posted, unchanged and still approved`
    : `plan ${next.seal.slice(0, 8)} posted. Ask "${APPROVAL_QUESTION}" with the options "${APPROVE}" and "Change".`;
}

/** The `call` flags; `parseArgs` reads them and `usage` shows each with its hint. */
const CALL = {
  choice: { type: "string", hint: "what was open" },
  picked: { type: "string", hint: "what you chose" },
  other: { type: "string", multiple: true, hint: "an option you did not pick" },
  why: { type: "string", hint: "why this one" },
  undo: { type: "string", hint: "what reversing it takes" },
} as const;

type Flags = ReturnType<typeof parseArgs<{ options: typeof CALL; strict: true }>>["values"];

async function call(h: Here, v: Flags): Promise<string> {
  const one = (k: "choice" | "picked" | "why" | "undo") => {
    const x = v[k]?.trim() ?? "";

    if (x === "") throw new Refusal(`--${k} "<${CALL[k].hint}>" is required`, 2);

    return x;
  };

  const [choice, picked, why, undo] = [one("choice"), one("picked"), one("why"), one("undo")];

  if (why.length > WHY_MAX) throw new Refusal(`--why is over ${WHY_MAX} characters; say it shorter`, 2);
  const others = (v.other ?? []).flatMap((o) => (o.trim() === "" ? [] : [o.trim()]));
  const cs = await comments(run, h.repo, h.issue);

  const already = factoryComments(cs, h.actors).some(
    ({ c }) => c.kind === "call" && c.choice === choice && c.picked === picked,
  );

  if (already) return "call already posted";
  await post(run, h.repo, h.issue, { kind: "call", issue: h.issue, choice, picked, others, why, undo });

  return "call posted";
}

async function handoff(h: Here): Promise<string> {
  const text = (await read(h.cwd, HANDOFF_PATH)).trim();
  const cs = await comments(run, h.repo, h.issue);
  await upsert(
    run,
    h.repo,
    h.issue,
    { kind: "handoff", issue: h.issue, text },
    cs,
    h.actors,
  );

  return "handoff posted";
}

async function pr(h: Here): Promise<string> {
  const cs = await comments(run, h.repo, h.issue);
  const p = latest(cs, h.actors, "plan");
  const local = seal(planText(await read(h.cwd, PLAN_PATH)));

  if (!p || p.c.seal !== local)
    throw new Refusal(
      "the plan on the issue is not the plan in the worktree; run plan, then ask for approval",
      4,
    );

  if (latest(cs, h.actors, "call") === null)
    throw new Refusal(
      "the issue has no call; post each choice you made without asking with `call` first",
      4,
    );

  if (!approved(cs, h.actors, p.c.seal))
    throw new Refusal("the plan is not approved; ask for approval first", 4);
  const head = branchFor(h.issue);

  const base = (
    await must(run, ["git", "rev-parse", "--abbrev-ref", "origin/HEAD"], {
      cwd: h.cwd,
    })
  ).trim();

  const changed = await must(
    run,
    ["git", "diff", "--name-only", `${base}...HEAD`],
    { cwd: h.cwd },
  );

  if (changed.split("\n").includes(RULES_PATH))
    throw new Refusal(
      `the branch changes ${RULES_PATH}; only a person changes the factory's rules`,
      4,
    );

  const open = (
    await must(run, [
      "gh",
      "pr",
      "list",
      "--repo",
      h.repo,
      "--head",
      head,
      "--state",
      "open",
      "--json",
      "url",
      "--jq",
      ".[0].url // empty",
    ])
  ).trim();

  const issueTitle = (
    await must(run, [
      "gh",
      "issue",
      "view",
      String(h.issue),
      "--repo",
      h.repo,
      "--json",
      "title",
      "--jq",
      ".title",
    ])
  ).trim();

  const url =
    open !== ""
      ? open
      : (
          await must(
            run,
            [
              "gh",
              "pr",
              "create",
              "--repo",
              h.repo,
              "--head",
              head,
              "--label",
              LABEL,
              "--title",
              issueTitle,
              "--body",
              `Closes #${h.issue}\n\nPlan: seal \`${p.c.seal.slice(0, 8)}\`, approved on #${h.issue}.`,
            ],
            { cwd: h.cwd },
          )
        ).trim();

  await must(run, ["gh", "pr", "merge", url, "--auto", "--squash"], {
    cwd: h.cwd,
  });

  return `${url} open, auto-merge on`;
}

async function stuck(h: Here, reason: string): Promise<string> {
  if (reason === "") throw new Refusal('stuck "<reason>" is required', 2);
  await markStuck(run, h.repo, h.issue, reason);

  return "marked stuck";
}

async function token(cwd: string): Promise<string> {
  return JSON.stringify(await botFor(await readApp(), await repoOf(run, cwd)));
}

/** How the run's prompt shows each command. */
export function usage(cli: string) {
  const flags = Object.entries(CALL)
    .map(([k, o]) => `--${k} "<${o.hint}>"`)
    .join(" ");

  return {
    plan: `${cli} plan`,
    call: `${cli} call ${flags}`,
    handoff: `${cli} handoff`,
    pr: `${cli} pr`,
    stuck: `${cli} stuck "<the reason, in one line>"`,
  };
}

async function main(argv: string[]): Promise<string> {
  const [name, ...rest] = argv;
  const cwd = process.cwd();

  switch (name) {
    case "plan":
      return plan(await here(cwd));
    case "call":
      return call(
        await here(cwd),
        parseArgs({ args: rest, options: CALL, strict: true }).values,
      );
    case "handoff":
      return handoff(await here(cwd));
    case "pr":
      return pr(await here(cwd));
    case "stuck":
      return stuck(await here(cwd), rest.join(" ").trim());
    case "token":
      return token(cwd);
    default:
      throw new Refusal(
        `usage: factory <plan|call|handoff|pr|stuck|token> …`,
        2,
      );
  }
}

if (import.meta.main)
  main(process.argv.slice(2)).then(
    (msg) => console.log(msg),
    (err: Error) => {
      console.error(
        `factory: ${messageOf(err)}`,
      );
      process.exit(err instanceof Refusal ? err.code : 1);
    },
  );
