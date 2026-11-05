import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "A teammate wants to delete our unit tests and test billing only end to end (docs/proposal-e2e-only.md). Are they right?",
    tools: "Ran 2 shell commands",
    activity: [
      {"at": 3.1, "line": "Running git ls-files && cat docs/proposal-e**2**e-only.md && …", "tool": "$ git ls-files && cat docs/proposal-e2e-only.md && ls docs; cat package.json"},
      {"at": 11.1, "line": "Running git ls-files && cat docs/proposal-e**2**e-only.md && …", "tool": "$ cat docs/incident-2026-10-14.md src/*.js test/unit/*.js test/e2e/*.js; npm test 2>&1 | tail -15"},
      {"at": 11.1, "line": "Running cat docs/incident-**2026**-**10**-**14**.md src/*.js test/uni…", "tool": "$ cat docs/incident-2026-10-14.md src/*.js test/unit/*.js test/e2e/*.js; npm test 2>&1 | tail -15"},
    ],
    replyAt: 32.3,
    chrome: [
      [-6.9, {"context": "0%"}],
      [-0.9, {"context": "0%", "spin": {"verb": "Germinating"}}],
      [2.1, {"context": "0%", "spin": {"verb": "Incubating", "tail": "thinking with medium effort"}}],
      [3.1, {"context": "4% · 35.3k", "spin": {"verb": "Incubating", "tail": "↓ 185 tokens"}}],
      [4.1, {"context": "4% · 35.3k", "spin": {"verb": "Incubating", "tail": "↓ 196 tokens · thought for 1s"}}],
      [5.1, {"context": "4% · 35.3k", "spin": {"verb": "Incubating", "tail": "↓ 199 tokens · thought for 1s"}}],
      [6.1, {"context": "4% · 35.3k", "spin": {"verb": "Incubating", "tail": "↓ 199 tokens"}}],
      [11.1, {"context": "4% · 35.9k", "spin": {"verb": "Incubating", "tail": "↓ 226 tokens"}}],
      [12.1, {"context": "4% · 35.9k", "spin": {"verb": "Incubating", "tail": "↓ 234 tokens"}}],
      [15.1, {"context": "4% · 35.9k", "spin": {"verb": "Incubating", "tail": "↓ 301 tokens"}}],
      [16.1, {"context": "4% · 35.9k", "spin": {"verb": "Incubating", "tail": "↓ 313 tokens · thinking with medium effort"}}],
      [26.1, {"context": "4% · 35.9k", "spin": {"verb": "Incubating", "tail": "↓ 313 tokens · still thinking with medium effort"}}],
      [29.1, {"context": "4% · 37.7k", "spin": {"verb": "Incubating", "tail": "↓ 835 tokens · thought for 13s"}}],
      [30.1, {"context": "4% · 37.7k", "spin": {"verb": "Incubating", "tail": "↓ 973 tokens · thought for 13s"}}],
      [30.1, {"context": "4% · 37.7k", "spin": {"verb": "Incubating", "tail": "↓ 1.1k tokens · thought for 13s"}}],
      [31.1, {"context": "4% · 37.7k", "spin": {"verb": "Incubating", "tail": "↓ 1.3k tokens"}}],
      [32.1, {"context": "4% · 37.7k"}],
    ],
    reply: [
      "**Partly.** They've found the right problem, but deleting the unit tests wouldn't fix it.",
      "",
      "**What they get right.** The fake was wrong and nothing caught it. `test/unit/fake-payments.js` kept answering `{ status: \"ok\" }` after payments v3 changed the reply to `{ state: \"succeeded\" }`, so all three unit tests stayed green while every invoice was marked \"unpaid\". Right now the fake is still only kept in line with the real service by hand.",
      "",
      "**Why deleting the unit tests doesn't fix it:**",
      "",
      "1. **What failed was the fake's description of the payments service, not unit testing itself.** The unit tests check our own logic: summing the lines, and setting \"paid\" or \"unpaid\" from the charge result. That logic was correct for the shape the fake gave it. The missing piece is a check that the fake matches the real service. Deleting the fake removes that gap, but it also removes 2-second tests you can run locally.",
      "2. **Running e2e on every pull request wouldn't have caught this incident sooner.** The breakage came from the payments team shipping v3 on Oct 12, not from one of our PRs. The e2e suite caught it on our next merge to main, 31 hours later. Running it on PRs only adds checks when *we* change something, so the delay would have been the same. What shortens it is running a check on a schedule, independent of our merges.",
      "3. **Going e2e-only costs a lot and loses coverage.** Every PR would wait about 14 minutes, nobody could run billing tests locally (CLAUDE.md says e2e can't run locally), and every test would depend on staging being up. Cases like a declined charge are cheap to set up with a fake and awkward against staging. The only e2e test today covers the \"paid\" path.",
      "",
      "**What I'd propose instead:**",
      "",
      "- **A contract test.** Write one set of assertions about what `payments.charge` returns (for example, `state` is one of `succeeded`, `declined`, `pending`). Run it against `fakePayments()` in `npm test` and against the real client (`src/payments.js`) on staging. If the fake drifts from the real service, the staging run fails. This also replaces the manual updating from the incident fix.",
      "- **Run the staging half on a schedule** (hourly or nightly), not only on merge. That catches changes on the payments team's side within hours rather than whenever we next merge.",
      "- **Keep the unit tests and the fake.** Keep e2e for a few full-path checks.",
      "",
      "**A related gap.** `src/invoices.js:9` treats anything other than `\"succeeded\"` as `\"unpaid\"`, so a `\"pending\"` charge, which v3 can return, marks the invoice unpaid. If the dunning job reacts to \"unpaid\", customers whose charge is still pending could get emails, which is close to what happened on Oct 14. Neither test suite covers `pending`. I haven't checked how dunning treats these invoices, but the contract test would bring this case up, and it's worth raising on Thursday.",
      "",
      "I didn't change anything. The 3 unit tests pass (`npm test`), and I couldn't run the e2e suite here because it needs staging. I can draft the contract test if you'd like to bring it to the sync.",
    ],
    keys: [
      [
        -1.8,
        "type",
        "A teammate wants to delete our unit tests and test billing only end to end (docs/proposal-e2e-only.md). Are they right?"
      ],
      [
        -0.2,
        "key",
        "Enter"
      ]
    ],
  },
];
