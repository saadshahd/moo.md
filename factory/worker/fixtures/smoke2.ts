import type { Comment } from "../../lib/github.ts";

/**
 * Smoke run 2 on saadshahd/factory-smoke, 2026-10-27, issue #5 (#63, "Smoke run 2 log defects"),
 * read from GitHub after the run. The pilot stopped session 0e462418 by hand before 00:48:10; the
 * worker then restarted it as a crash. PR #8 opened at 00:50:49 and merged at 00:51:11.
 */

export const ISSUE_5: Comment[] = [
  {
    "id": 6430719451,
    "body": "<!-- factory:plan {\"issue\":5,\"seal\":\"ae960ccc1a9702481f613aec3b7468e4fe2da3b3da4b30ac6d333d127e65370f\"} -->\n**Plan** · seal `ae960ccc`\n\n# Plan: task list stats (#5)\n\nA pure function that summarises a `TaskList` into counts and a whole-number percent done. `format` is untouched.\n\n## Types\n\n```ts\n// src/stats.ts\nexport type Stats = {\n  readonly open: number;\n  readonly done: number;\n  readonly percentDone: number; // whole percent 0..100, Math.round(done / total * 100); 0 for an empty list\n};\n```\n\n## Signatures\n\n```ts\n// src/stats.ts\nexport const stats: (list: TaskList) => Stats;\n```\n\n## Files\n\n- src/stats.ts\n- test/stats.test.ts",
    "url": "https://github.com/saadshahd/factory-smoke/issues/5#issuecomment-6430719451",
    "createdAt": "2026-10-27T00:34:08Z",
    "author": "moo-factory[bot]",
    "editor": null
  },
  {
    "id": 6430724321,
    "body": "<!-- factory:restart {\"issue\":5,\"reason\":\"crash\",\"session\":\"94637db3-4da9-4b97-aa43-4088b6605e34\"} -->\n**Restarted** · the run died; a fresh session goes on from the plan, branch and handoff",
    "url": "https://github.com/saadshahd/factory-smoke/issues/5#issuecomment-6430724321",
    "createdAt": "2026-10-27T00:34:30Z",
    "author": "saadshahd",
    "editor": null
  },
  {
    "id": 6430911594,
    "body": "<!-- factory:restart {\"issue\":5,\"reason\":\"crash\",\"session\":\"0e462418-b22d-4e15-a8ad-8d9676426c92\"} -->\n**Restarted** · the run died; a fresh session goes on from the plan, branch and handoff",
    "url": "https://github.com/saadshahd/factory-smoke/issues/5#issuecomment-6430911594",
    "createdAt": "2026-10-27T00:48:10Z",
    "author": "moo-factory[bot]",
    "editor": null
  },
  {
    "id": 6430915833,
    "body": "<!-- factory:wait {\"issue\":5,\"questions\":[{\"question\":\"Approve the plan posted on this issue?\",\"why\":\"Plan\",\"options\":[\"Approve\",\"Change\"]}],\"approves\":\"ae960ccc1a9702481f613aec3b7468e4fe2da3b3da4b30ac6d333d127e65370f\",\"answers\":[\"Approve\"]} -->\n**Waiting for you** · Approve the plan posted on this issue?\nChoices: Approve · Change\nAnswer: Approve",
    "url": "https://github.com/saadshahd/factory-smoke/issues/5#issuecomment-6430915833",
    "createdAt": "2026-10-27T00:48:29Z",
    "author": "moo-factory[bot]",
    "editor": "moo-factory[bot]"
  },
  {
    "id": 6430935405,
    "body": "<!-- factory:answer {\"issue\":5,\"wait\":6430915833,\"answers\":[\"Approve\"],\"approves\":\"ae960ccc1a9702481f613aec3b7468e4fe2da3b3da4b30ac6d333d127e65370f\"} -->\n**Answer** · Approve",
    "url": "https://github.com/saadshahd/factory-smoke/issues/5#issuecomment-6430935405",
    "createdAt": "2026-10-27T00:49:54Z",
    "author": "saadshahd",
    "editor": null
  },
  {
    "id": 6430945683,
    "body": "<!-- factory:call {\"issue\":5,\"choice\":\"How stats counts open tasks\",\"picked\":\"Reuse the existing open() filter from the list module; done = total - open\",\"others\":[\"Count each status separately with its own filter/reduce\"],\"undo\":\"Swap one line in src/stats.ts\"} -->\n**Call** · How stats counts open tasks\nPicked: Reuse the existing open() filter from the list module; done = total - open (not Count each status separately with its own filter/reduce)\nTo undo: Swap one line in src/stats.ts\n\nStatus is open|done only, so one count derives the other and the open-task concept stays in one place",
    "url": "https://github.com/saadshahd/factory-smoke/issues/5#issuecomment-6430945683",
    "createdAt": "2026-10-27T00:50:40Z",
    "author": "moo-factory[bot]",
    "editor": null
  },
  {
    "id": 6430946448,
    "body": "<!-- factory:handoff {\"issue\":5} -->\n**Handoff**\n\n# Handoff #5\n\nDone: plan approved; src/stats.ts (Stats type + stats function) and test/stats.test.ts committed and pushed; `bun run check` passes locally (10 tests).\nLeft: open the PR, watch checks, post the verdict comment.",
    "url": "https://github.com/saadshahd/factory-smoke/issues/5#issuecomment-6430946448",
    "createdAt": "2026-10-27T00:50:43Z",
    "author": "moo-factory[bot]",
    "editor": null
  }
];

export const PR_8: Comment[] = [
  {
    "id": 6430953751,
    "body": "**Verdict: meets the issue.**\n\n- Open count, done count, and percent done as a whole number, with 0 for an empty list: `stats` in `src/stats.ts` returns all three. It rounds to the nearest whole percent: 1 of 3 gives 33, 2 of 3 gives 67.\n- Its own type and function in a new module: `Stats` and `stats` are both in `src/stats.ts`.\n- Tests: `test/stats.test.ts` covers an empty list, a mixed list, rounding, and a list with every task done.\n- `format` stays as it is: `src/format.ts` is not changed.\n- The diff matches the approved plan's Types, Signatures and Files. The CI check passes.",
    "url": "https://github.com/saadshahd/factory-smoke/pull/8#issuecomment-6430953751",
    "createdAt": "2026-10-27T00:51:16Z",
    "author": "moo-factory[bot]",
    "editor": null
  },
  {
    "id": 6430954825,
    "body": "<!-- factory:cost {\"issue\":5,\"pr\":8,\"sessions\":[\"94637db3-4da9-4b97-aa43-4088b6605e34\",\"0e462418-b22d-4e15-a8ad-8d9676426c92\",\"24159a37-20be-4f92-8ce3-4581d508c0a4\"],\"input\":56,\"cacheRead\":1170816,\"cacheWrite\":90258,\"output\":7966} -->\n**Cost** · 1,269,096 tokens: 56 input, 1170816 cache read, 90258 cache write, 7966 output, over 3 session(s)",
    "url": "https://github.com/saadshahd/factory-smoke/pull/8#issuecomment-6430954825",
    "createdAt": "2026-10-27T00:51:21Z",
    "author": "moo-factory[bot]",
    "editor": null
  }
];
