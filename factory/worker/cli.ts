/**
 * What a factory run calls to write to GitHub, so every factory comment has one shape and is
 * posted once. Run inside the run's worktree: the branch names the issue. `parseArgs` reads
 * the `call` flags `usage` in `lib/commands.ts` shows the run.
 */

import { parseArgs } from "node:util";
import { messageOf } from "../lib/errors.ts";
import { CALL } from "../lib/commands.ts";
import { holder, WHY_MAX, type Plan } from "../lib/formats.ts";
import {
  branchFor, factoryComments, issueOf, latest, markStuck, must, post, repoOf, upsert, type Actors,
} from "../lib/github.ts";
import { heldOn, heldSince, planHold } from "../lib/holds.ts";
import { HANDOFF_PATH, PLAN_PATH, planFiles, planGaps, planText } from "../lib/plan.ts";
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
  const issue = issueOf(await must(run, ["git", "branch", "--show-current"], { cwd }));

  if (issue === null) throw new Refusal("not on a factory/<n> branch", 2);
  const repo = await repoOf(run, cwd);

  return { cwd, issue, repo, actors: actorsOf(await readRules(run, cwd), repo) };
}

async function read(cwd: string, path: string): Promise<string> {
  const f = Bun.file(`${cwd}/${path}`);

  if (!(await f.exists())) throw new Refusal(`${path} does not exist; write it first`, 2);

  return f.text();
}

async function plan(h: Here): Promise<string> {
  const text = planText(await read(h.cwd, PLAN_PATH));
  const gaps = planGaps(text);

  if (gaps.length > 0) throw new Refusal(`the plan lacks: ${gaps.join(", ")}. Fill each and run plan again.`, 2);
  const hold = planHold(h.issue, planFiles(text), await readSnapshot(run, h.repo, []), h.actors);
  const cs = await comments(run, h.repo, h.issue);

  if (hold !== null) {
    const on = heldOn(hold);
    const was = heldSince(cs, h.actors);

    if (was === null || holder(was) !== holder(on)) await post(run, h.repo, h.issue, { kind: "held", issue: h.issue, on });

    throw new Refusal(
      hold.kind === "pr"
        ? `the plan touches ${hold.files.join(", ")}, which open PR #${hold.pr} also changes. Stop: the factory takes this issue again after #${hold.pr} merges.`
        : `the plan touches ${hold.files.join(", ")}, which the plan of #${hold.issue}, posted first, also touches. Stop: the factory takes this issue again after #${hold.issue}'s PR merges or #${hold.issue} ends.`,
      3,
    );
  }

  const next: Plan = { kind: "plan", issue: h.issue, seal: seal(text), text };
  await upsert(run, h.repo, h.issue, next, cs, h.actors);

  return approved(cs, h.actors, next.seal)
    ? `plan ${next.seal.slice(0, 8)} posted, unchanged and still approved`
    : `plan ${next.seal.slice(0, 8)} posted. Ask "${APPROVAL_QUESTION}" with the options "${APPROVE}" and "Change".`;
}

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

  if (factoryComments(cs, h.actors).some(({ c }) => c.kind === "call" && c.choice === choice && c.picked === picked))
    return "call already posted";
  await post(run, h.repo, h.issue, { kind: "call", issue: h.issue, choice, picked, others, why, undo });

  return "call posted";
}

async function handoff(h: Here): Promise<string> {
  const text = (await read(h.cwd, HANDOFF_PATH)).trim();
  const cs = await comments(run, h.repo, h.issue);
  await upsert(run, h.repo, h.issue, { kind: "handoff", issue: h.issue, text }, cs, h.actors);

  return "handoff posted";
}

async function pr(h: Here): Promise<string> {
  const cs = await comments(run, h.repo, h.issue);
  const p = latest(cs, h.actors, "plan");
  const local = seal(planText(await read(h.cwd, PLAN_PATH)));

  if (!p || p.c.seal !== local)
    throw new Refusal("the plan on the issue is not the plan in the worktree; run plan, then ask for approval", 4);

  if (latest(cs, h.actors, "call") === null)
    throw new Refusal("the issue has no call; post each choice you made without asking with `call` first", 4);

  if (!approved(cs, h.actors, p.c.seal)) throw new Refusal("the plan is not approved; ask for approval first", 4);
  const head = branchFor(h.issue);
  const sh = async (...argv: string[]) => (await must(run, argv, { cwd: h.cwd })).trim();
  const base = await sh("git", "rev-parse", "--abbrev-ref", "origin/HEAD");
  const changed = await sh("git", "diff", "--name-only", `${base}...HEAD`);

  if (changed.split("\n").includes(RULES_PATH))
    throw new Refusal(`the branch changes ${RULES_PATH}; only a person changes the factory's rules`, 4);

  const open = await sh("gh", "pr", "list", "--repo", h.repo, "--head", head, "--state", "open",
    "--json", "url", "--jq", ".[0].url // empty");

  const title = await sh("gh", "issue", "view", String(h.issue), "--repo", h.repo, "--json", "title", "--jq", ".title");
  const body = `Closes #${h.issue}\n\nPlan: seal \`${p.c.seal.slice(0, 8)}\`, approved on #${h.issue}.`;

  const url =
    open !== ""
      ? open
      : await sh("gh", "pr", "create", "--repo", h.repo, "--head", head, "--label", LABEL,
          "--title", title, "--body", body);

  await sh("gh", "pr", "merge", url, "--auto", "--squash");

  return `${url} open, auto-merge on`;
}

async function main(argv: string[]): Promise<string> {
  const [name, ...rest] = argv;
  const cwd = process.cwd();

  switch (name) {
    case "plan":
      return plan(await here(cwd));
    case "call":
      return call(await here(cwd), parseArgs({ args: rest, options: CALL, strict: true }).values);
    case "handoff":
      return handoff(await here(cwd));
    case "pr":
      return pr(await here(cwd));
    case "stuck": {
      const h = await here(cwd);
      const reason = rest.join(" ").trim();

      if (reason === "") throw new Refusal('stuck "<reason>" is required', 2);
      await markStuck(run, h.repo, h.issue, reason);

      return "marked stuck";
    }

    case "token":
      return JSON.stringify(await botFor(await readApp(), await repoOf(run, cwd)));
    default:
      throw new Refusal(`usage: factory <plan|call|handoff|pr|stuck|token> …`, 2);
  }
}

if (import.meta.main)
  main(process.argv.slice(2)).then(
    (msg) => console.log(msg),
    (err: Error) => {
      console.error(`factory: ${messageOf(err)}`);
      process.exit(err instanceof Refusal ? err.code : 1);
    },
  );
