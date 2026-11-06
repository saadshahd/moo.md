import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%"};

export const turns: Turn[] = [
  {
    user: "Add a late fee to overdue invoices. /domain-modeling /tdd /show-me",
    tools: "Edited 5 files +40 -8, read 1 file, listed 1 directory, called 6 tools, ran 6 shell commands",
    activity: [
      {"at": 7.3, "line": "Calling **3** tools, running **1** shell command…", "tool": "$ git log --stat -5 && ls -la && find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -print | head -100"},
      {"at": 10.3, "line": "Calling **3** tools, running **2** shell commands…", "tool": "$ git log --stat -5 && ls -la && find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -print | head -100"},
      {"at": 11.3, "line": "Reading all source, testing, and config files", "tool": "$ for f in README.md .gitignore package.json src/invoice.js test/invoice.test.js; do echo \"=== $f\"; cat -n \"$f\"; done; ls .codegraph CONTEXT.md CONTEXT-MAP.md docs 2>&1; node --version; ls ~/.claude/projects/-Users-dev-invoices/memory/ 2>&1"},
      {"at": 19.3, "line": "Running the existing test suite", "tool": "$ npm test 2>&1 | tail -15"},
      {"at": 190.3, "line": "Late fee on overdue invoices: how is the fee amount set? (The repo has no definition yet. Invoices already carry their own \\`termsDays\\` and \\`totalCents\\` in cents.)", "tool": "$ npm test 2>&1 | tail -15"},
      {"at": 194.3, "line": "Reading glossary format reference and listing TDD skill files", "tool": "$ cat ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling/CONTEXT-FORMAT.md; ls ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/tdd/"},
      {"at": 228.3, "line": "Reading TDD good-test examples reference", "tool": "$ cat ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/tdd/tests.md | head -60"},
      {"at": 234.3, "line": "Adding first late-fee test and running suite expecting failure", "tool": "$ python3 - <<'EOF'\np = \"test/invoice.test.js\"\ns = open(p).read()\ns = s.replace('totalCents: 120000, paidOn: null };', 'totalCents: 120000, lateFeeCents: 2500, paidOn: null };')\ns = s.replace('  assert.equal(amountDue(paid), 0);', '  assert.equal(amountDue(paid, \"2026-11-01\"), 0);')\ns += '''\ntest(\"an overdue invoice owes its total plus a one-time late fee\", () => {\n  assert.equal(amountDue(inv, \"2026-10-16\"), 122500);\n  assert.equal(amountDue(inv, \"2027-03-01\"), 122500);\n});\n'''\nopen(p, \"w\").write(s)\nEOF\ngit diff test/ && npm test 2>&1 | grep -E \"^(not ok|ok|# (pass|fail))|expected|actual\""},
      {"at": 234.3, "line": "Adding first late-fee test and running suite expecting failure", "tool": "$ cat ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/tdd/tests.md | head -60"},
      {"at": 238.3, "line": "Adding first late-fee test and running suite expecting failure", "tool": "$ npm test 2>&1 | grep -E \"^(not ok|ok|# (pass|fail))|expected|actual\""},
      {"at": 242.3, "line": "Adding due-date boundary test and running expecting failure", "tool": "$ cat >> test/invoice.test.js <<'EOF'\n\ntest(\"an invoice owes only its total until it is overdue\", () => {\n  assert.equal(amountDue(inv, \"2026-10-01\"), 120000);\n  assert.equal(amountDue(inv, \"2026-10-15\"), 120000);\n});\nEOF\nnpm test 2>&1 | grep -E \"^(not ok|ok|# (pass|fail))|expected|actual\""},
      {"at": 243.3, "line": "Adding due-date boundary test and running expecting failure", "tool": "$ npm test 2>&1 | grep -E \"^(not ok|ok|# (pass|fail))|expected|actual\""},
      {"at": 250.3, "line": "Running tests and listing every amountDue caller", "tool": "$ npm test 2>&1 | grep -E \"^(not ok|ok|# (pass|fail))|expected|actual\"; grep -rn \"amountDue\" --include=*.js --include=*.md . | grep -v node_modules"},
      {"at": 253.3, "line": "Running tests and listing every amountDue caller", "tool": "$ grep -rn \"amountDue\" . --exclude-dir=.git; echo; git status --short; git diff src/"},
      {"at": 310.3, "line": "Editing CONTEXT.md", "tool": "$ grep -rn \"amountDue\" . --exclude-dir=.git; echo; git status --short; git diff src/"},
    ],
    launches: [
      {"at": 3.852, "skill": "mattpocock-skills:domain-modeling"},
      {"at": 4.632, "skill": "mattpocock-skills:tdd"},
      {"at": 4.832, "skill": "show-me:show-me"},
    ],
    dialogs: [
      {
        "at": [
          77.7,
          189.8
        ],
        "after": 4,
        "tool": "$ npm test 2>&1 | tail -15",
        "questions": [
          {
            "header": "Fee shape",
            "question": "Late fee on overdue invoices: how is the fee amount set? (The repo has no definition yet. Invoices already carry their own `termsDays` and `totalCents` in cents.)",
            "multiSelect": false,
            "options": [
              {
                "label": "Flat cents, per invoice (Recommended)",
                "description": "Each invoice carries its own `lateFeeCents` (e.g. 2500 = $25), like it carries `termsDays`. No rounding issues."
              },
              {
                "label": "Percent of total, per invoice",
                "description": "Each invoice carries a rate; fee = totalCents × rate, rounded to whole cents (I'd use round-half-up)."
              },
              {
                "label": "One global flat fee",
                "description": "Same fee for every invoice, a single constant in code. Simplest, but every invoice has to follow it."
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "Recurrence",
            "question": "Late fee: how many times is it charged while an invoice stays unpaid past its due date?",
            "multiSelect": false,
            "options": [
              {
                "label": "Once (Recommended)",
                "description": "Charged once when the invoice becomes overdue. It never grows after that."
              },
              {
                "label": "Every 30 days overdue",
                "description": "A new fee on overdue day 1, 31, 61, and so on. Needs a rule for whether it compounds and whether there's a cap."
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "Start",
            "question": "Late fee: when does an invoice start owing it? (Today an invoice is 'overdue' from the day after its due date, e.g. due 2026-10-15 → overdue on 2026-10-16.)",
            "multiSelect": false,
            "options": [
              {
                "label": "The day it becomes overdue (Recommended)",
                "description": "Same rule as the existing `isOverdue`: due 10-15 → fee owed from 10-16."
              },
              {
                "label": "After a grace period",
                "description": "Fee owed only after N extra days overdue. Tell me N, or whether it's set per invoice."
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "Test seams",
            "question": "Late fee tests: which public function(s) should the tests drive? Either way, `amountDue` gains a required `today` argument (what's owed now depends on the date), the fee counts toward what's owed, and a paid invoice still owes 0.",
            "multiSelect": false,
            "options": [
              {
                "label": "amountDue(invoice, today) only (Recommended)",
                "description": "The fee is visible only through what's owed. One seam, smallest public surface."
              },
              {
                "label": "Also export lateFee(invoice, today)",
                "description": "A second public seam that returns only the fee, e.g. to print it as its own line on the bill."
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 320.5,
    chrome: [
      [-2.7, {"context": "0%"}],
      [-0.7, {"context": "0%", "spin": {"verb": "Caramelizing"}}],
      [2.3, {"context": "0%", "spin": {"verb": "Considering", "tail": ""}}],
      [3.3, {"context": "3% · 33.5k", "spin": {"verb": "Considering", "tail": "↓ 150 tokens"}}],
      [4.3, {"context": "3% · 33.5k", "spin": {"verb": "Considering", "tail": "↓ 243 tokens"}}],
      [5.3, {"context": "3% · 33.5k", "spin": {"verb": "Considering", "tail": "↓ 356 tokens"}}],
      [5.3, {"context": "3% · 33.5k", "spin": {"verb": "Considering", "tail": "↓ 373 tokens"}}],
      [6.3, {"context": "3% · 33.5k", "spin": {"verb": "Considering", "tail": "↓ 380 tokens"}}],
      [7.3, {"context": "4% · 37.4k", "spin": {"verb": "Considering", "tail": "↓ 541 tokens"}}],
      [8.3, {"context": "4% · 37.4k", "spin": {"verb": "Considering", "tail": "↓ 588 tokens"}}],
      [8.3, {"context": "4% · 37.4k", "spin": {"verb": "Considering", "tail": "↓ 600 tokens"}}],
      [11.3, {"context": "4% · 37.4k", "spin": {"verb": "Considering", "tail": "↓ 624 tokens"}}],
      [11.3, {"context": "4% · 37.4k", "spin": {"verb": "Considering", "tail": "↓ 660 tokens"}}],
      [12.3, {"context": "4% · 38.1k", "spin": {"verb": "Considering", "tail": "↓ 791 tokens"}}],
      [13.3, {"context": "4% · 38.1k", "spin": {"verb": "Considering", "tail": "↓ 820 tokens"}}],
      [13.3, {"context": "4% · 38.1k", "spin": {"verb": "Considering", "tail": "↓ 828 tokens"}}],
      [19.3, {"context": "4% · 39.2k", "spin": {"verb": "Considering", "tail": "↓ 1.4k tokens"}}],
      [20.3, {"context": "4% · 39.2k", "spin": {"verb": "Considering", "tail": "↓ 1.5k tokens"}}],
      [22.3, {"context": "4% · 40k", "spin": {"verb": "Considering", "tail": "↓ 1.5k tokens"}}],
      [70.3, {"context": "4% · 40k", "spin": {"verb": "Considering", "tail": "↓ 2.8k tokens"}}],
      [71.3, {"context": "4% · 40k", "spin": {"verb": "Considering", "tail": "↓ 2.9k tokens"}}],
      [72.3, {"context": "4% · 40k", "spin": {"verb": "Considering", "tail": "↓ 3.0k tokens"}}],
      [73.3, {"context": "4% · 40k", "spin": {"verb": "Considering", "tail": "↓ 3.1k tokens"}}],
      [75.3, {"context": "4% · 40k", "spin": {"verb": "Considering", "tail": "↓ 3.2k tokens"}}],
      [76.3, {"context": "4% · 40k", "spin": {"verb": "Considering", "tail": "↓ 3.3k tokens"}}],
      [189.3, {"context": "4% · 41.1k", "spin": {"verb": "Considering", "tail": "↓ 3.9k tokens"}}],
      [193.3, {"context": "4% · 43.8k", "spin": {"verb": "Considering", "tail": "↓ 4.1k tokens"}}],
      [194.3, {"context": "4% · 43.8k", "spin": {"verb": "Considering", "tail": "↓ 4.2k tokens"}}],
      [224.3, {"context": "4% · 43.8k", "spin": {"verb": "Considering", "tail": "↓ 7.0k tokens"}}],
      [225.3, {"context": "4% · 45k", "spin": {"verb": "Considering", "tail": "↓ 7.0k tokens"}}],
      [226.3, {"context": "4% · 45k", "spin": {"verb": "Considering", "tail": "↓ 7.1k tokens"}}],
      [226.3, {"context": "4% · 45k", "spin": {"verb": "Considering", "tail": "↓ 7.2k tokens"}}],
      [228.3, {"context": "4% · 45k", "spin": {"verb": "Considering", "tail": "↓ 7.3k tokens"}}],
      [228.3, {"context": "4% · 45k", "spin": {"verb": "Considering", "tail": "↓ 7.5k tokens"}}],
      [229.3, {"context": "4% · 45k", "spin": {"verb": "Considering", "tail": "↓ 7.6k tokens"}}],
      [231.3, {"context": "5% · 49.2k", "spin": {"verb": "Considering", "tail": "↓ 7.7k tokens"}}],
      [231.3, {"context": "5% · 49.2k", "spin": {"verb": "Considering", "tail": "↓ 7.9k tokens"}}],
      [232.3, {"context": "5% · 49.2k", "spin": {"verb": "Considering", "tail": "↓ 8.0k tokens"}}],
      [234.3, {"context": "5% · 49.2k", "spin": {"verb": "Considering", "tail": "↓ 8.1k tokens"}}],
      [236.3, {"context": "5% · 50.2k", "spin": {"verb": "Considering", "tail": "↓ 8.3k tokens"}}],
      [237.3, {"context": "5% · 50.2k", "spin": {"verb": "Considering", "tail": "↓ 8.4k tokens"}}],
      [239.3, {"context": "5% · 50.2k", "spin": {"verb": "Considering", "tail": "↓ 8.5k tokens"}}],
      [241.3, {"context": "5% · 50.8k", "spin": {"verb": "Considering", "tail": "↓ 8.5k tokens"}}],
      [242.3, {"context": "5% · 50.8k", "spin": {"verb": "Considering", "tail": "↓ 8.6k tokens"}}],
      [242.3, {"context": "5% · 50.8k", "spin": {"verb": "Considering", "tail": "↓ 8.7k tokens"}}],
      [244.3, {"context": "5% · 50.8k", "spin": {"verb": "Considering", "tail": "↓ 8.8k tokens"}}],
      [246.3, {"context": "5% · 51.2k", "spin": {"verb": "Considering", "tail": "↓ 8.9k tokens"}}],
      [247.3, {"context": "5% · 51.2k", "spin": {"verb": "Considering", "tail": "↓ 9.1k tokens"}}],
      [247.3, {"context": "5% · 51.2k", "spin": {"verb": "Considering", "tail": "↓ 9.2k tokens"}}],
      [249.3, {"context": "5% · 51.2k", "spin": {"verb": "Considering", "tail": "↓ 9.3k tokens"}}],
      [250.3, {"context": "5% · 51.2k", "spin": {"verb": "Considering", "tail": "↓ 9.4k tokens"}}],
      [250.3, {"context": "5% · 51.2k", "spin": {"verb": "Considering", "tail": "↓ 9.5k tokens"}}],
      [252.3, {"context": "5% · 52.3k", "spin": {"verb": "Considering", "tail": "↓ 9.6k tokens"}}],
      [253.3, {"context": "5% · 52.3k", "spin": {"verb": "Considering", "tail": "↓ 9.8k tokens"}}],
      [257.3, {"context": "5% · 53.3k", "spin": {"verb": "Considering", "tail": "↓ 9.9k tokens"}}],
      [258.3, {"context": "5% · 53.3k", "spin": {"verb": "Considering", "tail": "↓ 10.1k tokens"}}],
      [310.3, {"context": "5% · 53.3k", "spin": {"verb": "Considering", "tail": "↓ 10.2k tokens"}}],
      [311.3, {"context": "5% · 54.5k", "spin": {"verb": "Considering", "tail": "↓ 10.2k tokens"}}],
      [319.3, {"context": "5% · 54.7k", "spin": {"verb": "Considering", "tail": "↓ 11.0k tokens"}}],
      [320.3, {"context": "5% · 54.7k"}],
    ],
    reply: [
      "Overdue invoices now owe a late fee. It's a flat amount stored on each invoice, charged once, and owed from the day after the due date. The fee only shows up through `amountDue`. All 5 tests pass, and nothing is committed.",
      "",
      "**What it owes over time** (example invoice: total 120000, fee 2500, due 2026-10-15)",
      "```text",
      "10-01 … 10-15 (due date)       → 120000   total only",
      "10-16 onward, however long     → 122500   total + late fee, charged once",
      "paid, on any day               → 0",
      "```",
      "",
      "**The change** (`src/invoice.js:15`)",
      "```diff",
      "-export function amountDue(invoice) {",
      "-  return invoice.paidOn === null ? invoice.totalCents : 0;",
      "+export function amountDue(invoice, today) {",
      "+  if (invoice.paidOn !== null) return 0;",
      "+  const lateFee = isOverdue(invoice, today) ? invoice.lateFeeCents : 0;",
      "+  return invoice.totalCents + lateFee;",
      " }",
      "```",
      "- Invoices now carry a `lateFeeCents` field, the same way they carry `termsDays`.",
      "- `amountDue` now requires `today`, because what's owed depends on the date. The tests were its only caller, and I updated them in the same change.",
      "- The fee uses the existing `isOverdue` rule, so \"overdue\" is still defined in one place.",
      "",
      "**Tests** (built one at a time, each failing first)",
      "- **Fee on a paid invoice:** the existing \"paid invoice owes nothing\" test now passes a date. That invoice was paid late (10-20), so it also proves a late payment owes no extra fee.",
      "- **Fee charged one day early or late:** \"owes only its total until it is overdue\" checks 10-01 and 10-15. It failed until the overdue check was added.",
      "- **Fee growing over time:** \"owes its total plus a one-time late fee\" checks 10-16 and 2027-03-01, and both must be 122500.",
      "",
      "**Glossary:** I created `CONTEXT.md` with six terms: Invoice, Terms, Due date, Overdue, Late fee and Amount due. I didn't write a decision record, because nothing here is hard to undo.",
      "",
      "**Decision for you:** two of your principles conflict. Two mistakes now give a wrong answer with no error:",
      "- **No date passed:** calling `amountDue(overdueInvoice)` without `today` returns 120000, so the fee is quietly left out.",
      "- **No fee on the invoice:** an overdue invoice without `lateFeeCents` returns `NaN`.",
      "",
      "\"Fail loud\" says to add a guard. Matching the existing code says not to, since `isOverdue` already accepts a missing date without complaint. I'd add the guard: one failing test that `amountDue(inv)` throws, then a one-line check. Do you want it?",
    ],
    keys: [
      [
        -1.9,
        "type",
        "Add a late fee to overdue invoices. /domain-modeling /tdd /show-me"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ],
      [
        112.8,
        "key",
        "Enter"
      ],
      [
        138.3,
        "key",
        "Enter"
      ],
      [
        163.0,
        "key",
        "Enter"
      ],
      [
        187.8,
        "key",
        "Enter"
      ],
      [
        189.9,
        "key",
        "Enter"
      ]
    ],
    menu: {
      "after": 0,
      "rows": [
        [
          [
            "  "
          ],
          [
            "  /",
            "g"
          ],
          [
            "show-me",
            "b"
          ],
          [
            "                        Help the user understand the current topic",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "visually with concise diagrams, code-shap…",
            "g"
          ]
        ],
        [
          [
            "  "
          ],
          [
            "  /",
            "g"
          ],
          [
            "show-me",
            "b"
          ],
          [
            ":show-me                (",
            "g"
          ],
          [
            "show-me",
            "b"
          ],
          [
            ") Help the user understand the",
            "g"
          ]
        ],
        [
          [
            "                                    "
          ],
          [
            "current topic visually with concise diagr…",
            "g"
          ]
        ]
      ]
    },
  },
];
