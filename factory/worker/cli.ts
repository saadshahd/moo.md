// What a factory run calls to write to GitHub, so every factory comment has one shape and is
// posted once. Run inside the run's worktree: the branch names the issue.
//   plan                                  check and seal .factory/plan.md, post it
//   call --choice … --picked … --undo …   post a choice made without asking
//   handoff                               post .factory/handoff.md for the next session
//   pr                                    open the PR on the approved plan, auto-merge on
//   stuck "<reason>"                      mark the issue stuck and say why

import { approvalQuestion, type Plan } from "../lib/formats.ts";
import {
  branchFor,
  comments,
  issueOf,
  latest,
  must,
  openPrFiles,
  post,
  repoOf,
  upsert,
} from "../lib/github.ts";
import {
  HANDOFF_PATH,
  PLAN_PATH,
  overlap,
  planFiles,
  planGaps,
} from "../lib/plan.ts";
import { run } from "./proc.ts";

export const STUCK_LABEL = "factory:stuck";

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

async function where(cwd: string) {
  const issue = issueOf(
    await must(run, ["git", "branch", "--show-current"], { cwd }),
  );

  if (issue === null) throw new Refusal("not on a factory/<n> branch", 2);

  return { cwd, issue, repo: await repoOf(run, cwd) };
}

async function read(cwd: string, path: string): Promise<string> {
  const f = Bun.file(`${cwd}/${path}`);

  if (!(await f.exists()))
    throw new Refusal(`${path} does not exist; write it first`, 2);

  return f.text();
}

function flag(args: string[], name: string): string {
  const i = args.indexOf(`--${name}`);
  const v = i >= 0 ? args[i + 1] : undefined;

  if (v === undefined || v.trim() === "")
    throw new Refusal(`--${name} "<text>" is required`, 2);

  return v;
}

async function plan(cwd: string): Promise<string> {
  const w = await where(cwd);
  const text = (await read(cwd, PLAN_PATH)).trim();
  const gaps = planGaps(text);

  if (gaps.length > 0)
    throw new Refusal(
      `the plan lacks: ${gaps.join(", ")}. Fill each and run plan again.`,
      2,
    );
  const files = planFiles(text);

  for (const [pr, theirs] of await openPrFiles(run, w.repo, branchFor(w.issue))) {
    const both = overlap(files, theirs);

    if (both.length > 0)
      throw new Refusal(
        `the plan touches ${both.join(", ")}, which open PR #${pr} also changes. Stop: the factory takes this issue again after #${pr} merges.`,
        3,
      );
  }

  const s = seal(text);
  const old = latest(await comments(run, w.repo, w.issue), "plan");

  const next: Plan = {
    kind: "plan",
    issue: w.issue,
    seal: s,
    approved: old?.c.approved === s ? s : null,
    text,
  };

  await upsert(run, w.repo, w.issue, next);

  return next.approved === s
    ? `plan ${s.slice(0, 8)} posted, unchanged and still approved`
    : `plan ${s.slice(0, 8)} posted. Ask: "${approvalQuestion(w.issue, s)}"`;
}

async function call(cwd: string, args: string[]): Promise<string> {
  const w = await where(cwd);
  const choice = flag(args, "choice");
  const picked = flag(args, "picked");
  const undo = flag(args, "undo");

  const already = (await comments(run, w.repo, w.issue)).some((c) => {
    const p = latest([c], "call");

    return p !== null && p.c.choice === choice && p.c.picked === picked;
  });

  if (already) return "call already posted";
  await post(run, w.repo, w.issue, {
    kind: "call",
    issue: w.issue,
    choice,
    picked,
    undo,
  });

  return "call posted";
}

async function handoff(cwd: string): Promise<string> {
  const w = await where(cwd);
  const text = (await read(cwd, HANDOFF_PATH)).trim();
  await upsert(run, w.repo, w.issue, { kind: "handoff", issue: w.issue, text });

  return "handoff posted";
}

async function pr(cwd: string): Promise<string> {
  const w = await where(cwd);
  const p = latest(await comments(run, w.repo, w.issue), "plan");
  const local = seal((await read(cwd, PLAN_PATH)).trim());

  if (!p || p.c.seal !== local)
    throw new Refusal(
      "the plan on the issue is not the plan in the worktree; run plan, then ask for approval",
      4,
    );

  if (latest(await comments(run, w.repo, w.issue), "call") === null)
    throw new Refusal(
      "the issue has no call; post each choice you made without asking with `call` first",
      4,
    );

  if (p.c.approved !== p.c.seal)
    throw new Refusal("the plan is not approved; ask for approval first", 4);
  const head = branchFor(w.issue);

  // SAFETY: gh prints JSON with exactly the --json fields asked for, typed here.
  const open = JSON.parse(
    await must(run, [
      "gh",
      "pr",
      "list",
      "--repo",
      w.repo,
      "--head",
      head,
      "--state",
      "open",
      "--json",
      "number,url",
    ]),
  ) as { number: number; url: string }[];

  let url = open[0]?.url;

  if (!url) {
    const title = (
      await must(run, [
        "gh",
        "issue",
        "view",
        String(w.issue),
        "--repo",
        w.repo,
        "--json",
        "title",
        "--jq",
        ".title",
      ])
    ).trim();

    url = (
      await must(
        run,
        [
          "gh",
          "pr",
          "create",
          "--repo",
          w.repo,
          "--head",
          head,
          "--title",
          title,
          "--body",
          `Closes #${w.issue}\n\nPlan: seal \`${p.c.seal.slice(0, 8)}\`, approved on #${w.issue}.`,
        ],
        { cwd },
      )
    ).trim();
  }

  await must(run, ["gh", "pr", "merge", url, "--auto", "--squash"], { cwd });

  return `${url} open, auto-merge on`;
}

async function stuck(cwd: string, args: string[]): Promise<string> {
  const w = await where(cwd);
  const reason = args.join(" ").trim();

  if (reason === "") throw new Refusal('stuck "<reason>" is required', 2);
  await post(run, w.repo, w.issue, { kind: "stuck", issue: w.issue, reason });
  await must(run, [
    "gh",
    "label",
    "create",
    STUCK_LABEL,
    "--repo",
    w.repo,
    "--force",
    "--color",
    "B60205",
    "--description",
    "A factory run gave up; the comment says why",
  ]);
  await must(run, [
    "gh",
    "issue",
    "edit",
    String(w.issue),
    "--repo",
    w.repo,
    "--add-label",
    STUCK_LABEL,
  ]);

  return "marked stuck";
}

const COMMANDS = {
  plan,
  call,
  handoff,
  pr,
  stuck,
} satisfies Record<string, (cwd: string, args: string[]) => Promise<string>>;

if (import.meta.main) {
  const [name, ...args] = process.argv.slice(2);
  const cmd = Object.entries(COMMANDS).find(([k]) => k === name)?.[1];

  if (!cmd) {
    console.error(`usage: factory <${Object.keys(COMMANDS).join("|")}> …`);
    process.exit(2);
  }

  cmd(process.cwd(), args).then(
    (msg) => console.log(msg),
    (err: Error) => {
      console.error(
        `factory ${name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(err instanceof Refusal ? err.code : 1);
    },
  );
}
