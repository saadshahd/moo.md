import type { Rules } from "../../lib/rules.ts";
import type { Issue } from "../../lib/snapshot.ts";

/**
 * Smoke run 1 on saadshahd/factory-smoke, 2026-10-27 (issue #63, "Smoke run 1 failed").
 * `ISSUES` is the snapshot read from GitHub after the run: the bot's plans and the restarts the
 * worker posted as the user. The session lists rebuild the run's sessions (ids, names, start times
 * from `claude agents --json --all`) in the shapes probe sessions showed that day: a session whose
 * own question box waits is `blocked`, `waiting`, `waitingFor: "input needed"`; one that ended its
 * turn asking for help is `blocked`, `idle`, with no `waitingFor`. `OPEN_ASK` is the #5 run's
 * transcript tail, trimmed: its approval ask was open, and no line of it holds the ask.
 */

export const RULES: Rules = {"atOnce": 3, "waitsPerDay": 5, "contextCap": 300000, "bot": "moo-factory[bot]", "trusted": ["saadshahd"], "taste": [], "layers": {"check": [], "plan": [], "judge": [], "none": []}};

export const ISSUES: Issue[] = [
  {
    "number": 5,
    "title": "Task list stats",
    "url": "https://github.com/saadshahd/factory-smoke/issues/5",
    "body": "Add a summary of a task list: how many tasks are open, how many are done, and the share done as a whole percent (0 for an empty list).\n\nExpose it as its own type and function in a new module, with tests. `format` stays as it is.",
    "author": "saadshahd",
    "editor": null,
    "labels": [
      "factory",
      "smoke"
    ],
    "labelledBy": "saadshahd",
    "blocked": false,
    "comments": [
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
      }
    ]
  },
  {
    "number": 6,
    "title": "Parse a markdown checklist into a task list",
    "url": "https://github.com/saadshahd/factory-smoke/issues/6",
    "body": "Read text like\n\n```\n- [ ] buy milk\n- [x] call mum\n```\n\ninto a `TaskList`, numbering tasks from 1 in order. A line that is not a checklist item is an error that names the line number; blank lines are skipped. Model the error as its own type rather than a thrown string. New module plus tests.",
    "author": "saadshahd",
    "editor": null,
    "labels": [
      "factory",
      "smoke"
    ],
    "labelledBy": "saadshahd",
    "blocked": false,
    "comments": [
      {
        "id": 6430723309,
        "body": "<!-- factory:plan {\"issue\":6,\"seal\":\"794527d9497cc916db91d7837c85bb63aea1987cfe742de57b28e518970fee08\"} -->\n**Plan** · seal `794527d9`\n\n# Plan: parse a markdown checklist into a task list (#6)\n\n`parse(text)` reads `- [ ] title` / `- [x] title` lines into a `TaskList`,\nnumbering tasks 1, 2, … in order. Blank (whitespace-only) lines are skipped.\nThe first line that is not a checklist item stops the parse and comes back as\na `ParseError` value naming its 1-based line number — returned, not thrown.\n\n## Types\n\n```ts\n// src/parse.ts\nexport type ParseError = {\n  readonly kind: \"not-a-checklist-item\";\n  readonly line: number; // 1-based line number in the input\n  readonly text: string; // the offending line, as written\n};\n\nexport type ParseResult =\n  | { readonly ok: true; readonly list: TaskList }\n  | { readonly ok: false; readonly error: ParseError };\n```\n\n## Signatures\n\n```ts\n// src/parse.ts\nexport const parse = (text: string): ParseResult;\n```\n\n- A checklist item is `- [ ] <title>` or `- [x] <title>` (`X` also accepted), at\n  the start of the line, with a non-blank title. Tasks are built with the\n  existing `createTask` (which trims the title) and `complete`.\n- Lines split on `\\n` or `\\r\\n`.\n- Anything else non-blank (prose, `*` bullets, indented items, `- [ ]` with no\n  title) is a `ParseError` for that line.\n\n## Files\n\n- src/parse.ts\n- test/parse.test.ts",
        "url": "https://github.com/saadshahd/factory-smoke/issues/6#issuecomment-6430723309",
        "createdAt": "2026-10-27T00:34:25Z",
        "author": "moo-factory[bot]",
        "editor": null
      }
    ]
  },
  {
    "number": 7,
    "title": "Undo and redo for task list changes",
    "url": "https://github.com/saadshahd/factory-smoke/issues/7",
    "body": "Keep a history of task list states so a caller can undo the last change and redo it. Undo with nothing to undo, or redo with nothing to redo, leaves the history as it is. A new change after an undo drops the redo steps.\n\nModel the history as its own type in a new module, with tests. `add` and `markDone` stay as they are.",
    "author": "saadshahd",
    "editor": null,
    "labels": [
      "factory",
      "smoke"
    ],
    "labelledBy": "saadshahd",
    "blocked": false,
    "comments": [
      {
        "id": 6430720451,
        "body": "<!-- factory:plan {\"issue\":7,\"seal\":\"2c165d45945c612f582259a4597f631c82224bf38e3b6677baad6ab90c4de3d8\"} -->\n**Plan** · seal `2c165d45`\n\n# Plan: undo and redo for task list changes (#7)\n\nA history is a value: the states before, the current state, and the states undone.\n`add` and `markDone` stay as they are; a caller records their result into the history.\n\n## Types\n\n- `History<T>` — `{ readonly past: readonly T[]; readonly present: T; readonly future: readonly T[] }`\n  - `past`: earlier states, oldest first\n  - `present`: the current state\n  - `future`: undone states, the next redo first\n\n## Signatures\n\n- `start<T>(present: T): History<T>` — a history with nothing to undo or redo\n- `record<T>(history: History<T>, next: T): History<T>` — `next` becomes present, old present joins past, future is dropped\n- `undo<T>(history: History<T>): History<T>` — step back one state; with empty `past`, returns `history` unchanged\n- `redo<T>(history: History<T>): History<T>` — step forward one state; with empty `future`, returns `history` unchanged\n\n## Files\n\n- src/history.ts\n- test/history.test.ts",
        "url": "https://github.com/saadshahd/factory-smoke/issues/7#issuecomment-6430720451",
        "createdAt": "2026-10-27T00:34:13Z",
        "author": "moo-factory[bot]",
        "editor": null
      },
      {
        "id": 6430724007,
        "body": "<!-- factory:restart {\"issue\":7,\"reason\":\"crash\",\"session\":\"167642fa-0d48-4475-84b6-1a36b6e7dcf0\"} -->\n**Restarted** · the run died; a fresh session goes on from the plan, branch and handoff",
        "url": "https://github.com/saadshahd/factory-smoke/issues/7#issuecomment-6430724007",
        "createdAt": "2026-10-27T00:34:29Z",
        "author": "saadshahd",
        "editor": null
      }
    ]
  }
];

/** At the tick that restarted #5 and #7 (00:34:30): #6 still working, #5 and #7 asking in their own box. */
export const AGENTS_AT_TICK = "[{\"pid\": 1, \"id\": \"94637db3\", \"cwd\": \"/Users/saad.shahd/repos/factory-smoke.factory-5\", \"kind\": \"background\", \"startedAt\": 1793061200618, \"sessionId\": \"94637db3-4da9-4b97-aa43-4088b6605e34\", \"name\": \"factory:saadshahd/factory-smoke#5\", \"status\": \"waiting\", \"waitingFor\": \"input needed\", \"state\": \"blocked\"}, {\"pid\": 2, \"id\": \"9585fa3e\", \"cwd\": \"/Users/saad.shahd/repos/factory-smoke.factory-6\", \"kind\": \"background\", \"startedAt\": 1793061203769, \"sessionId\": \"9585fa3e-0ab0-4988-bbdb-5f2fec1e738f\", \"name\": \"factory:saadshahd/factory-smoke#6\", \"status\": \"busy\", \"state\": \"working\"}, {\"pid\": 3, \"id\": \"167642fa\", \"cwd\": \"/Users/saad.shahd/repos/factory-smoke.factory-7\", \"kind\": \"background\", \"startedAt\": 1793061206620, \"sessionId\": \"167642fa-0d48-4475-84b6-1a36b6e7dcf0\", \"name\": \"factory:saadshahd/factory-smoke#7\", \"status\": \"waiting\", \"waitingFor\": \"input needed\", \"state\": \"blocked\"}, {\"pid\": 4, \"cwd\": \"/Users/saad.shahd/repos/factory-smoke\", \"kind\": \"interactive\", \"startedAt\": 1793061281833, \"sessionId\": \"fcdbe27a-2fc4-4348-a196-afa98ef6dbfa\", \"name\": \"factory-smoke-3f\", \"status\": \"idle\"}]";

/** #5 a minute later: the first run stopped, the second ended its turn asking for a token. */
export const AGENTS_LATER = "[{\"id\": \"94637db3\", \"cwd\": \"/Users/saad.shahd/repos/factory-smoke.factory-5\", \"kind\": \"background\", \"startedAt\": 1793061200618, \"sessionId\": \"94637db3-4da9-4b97-aa43-4088b6605e34\", \"name\": \"factory:saadshahd/factory-smoke#5\", \"state\": \"stopped\"}, {\"pid\": 5, \"id\": \"0e462418\", \"cwd\": \"/Users/saad.shahd/repos/factory-smoke.factory-5\", \"kind\": \"background\", \"startedAt\": 1793061270865, \"sessionId\": \"0e462418-b22d-4e15-a8ad-8d9676426c92\", \"name\": \"factory:saadshahd/factory-smoke#5\", \"status\": \"idle\", \"state\": \"blocked\"}]";

export const OPEN_ASK = "{\"type\":\"assistant\",\"timestamp\":\"2026-10-27T00:34:06.705Z\",\"message\":{\"id\":\"msg_011CgRoWaNnWWcyuJGFgsDNB\",\"role\":\"assistant\",\"usage\":{\"input_tokens\":1,\"cache_read_input_tokens\":47531,\"cache_creation_input_tokens\":546,\"output_tokens\":234},\"content\":[{\"type\":\"tool_use\",\"id\":\"toolu_01Rw96z3BvdTyfK18GytDw5z\",\"name\":\"Bash\",\"input\":{\"command\":\"bun …/factory/0.1.0/worker/cli.ts plan\"}}]}}\n{\"type\":\"user\",\"timestamp\":\"2026-10-27T00:34:09.139Z\",\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":\"toolu_01Rw96z3BvdTyfK18GytDw5z\",\"content\":\"plan ae960ccc posted. Ask \\\"Approve the plan posted on this issue?\\\" with the options \\\"Approve\\\" and \\\"Change\\\".\"}]}}\n{\"type\":\"attachment\",\"timestamp\":\"2026-10-27T00:34:11.441Z\",\"attachment\":{\"type\":\"deferred_tools_record\",\"entries\":[],\"toolInputCopies\":[{\"id\":\"toolu_01Rw96z3BvdTyfK18GytDw5z\",\"copy\":\"wire\"}]}}\n";
