import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:compose Add a late fee to overdue invoices. /domain-modeling /tdd /show-me",
    tools: "Edited 8 files +62 -18, read 1 file, called 11 tools, ran 11 shell commands",
    activity: [
      {"at": 2.9, "line": "Showing repo history and file list", "tool": "$ git log --stat -5 && ls -la && find . -type f -not -path './.git/*' -not -path './node_modules/*' | head -100"},
      {"at": 5.9, "line": "Showing repo history and file list", "tool": "$ for f in README.md .gitignore package.json src/invoice.js test/invoice.test.js; do echo \"=== $f\"; cat -n \"$f\"; done; ls .codegraph 2>/dev/null; node --version; ls ~/.claude/projects/-Users-dev-invoices/memory/ 2>/dev/null"},
      {"at": 15.9, "line": "Calling **1** tool, running **2** shell commands…", "tool": "$ for f in README.md .gitignore package.json src/invoice.js test/invoice.test.js; do echo \"=== $f\"; cat -n \"$f\"; done; ls .codegraph 2>/dev/null; node --version; ls ~/.claude/projects/-Users-dev-invoices/memory/ 2>/dev/null"},
      {"at": 16.9, "line": "Calling **1** tool, running **3** shell commands…", "tool": "$ for f in README.md .gitignore package.json src/invoice.js test/invoice.test.js; do echo \"=== $f\"; cat -n \"$f\"; done; ls .codegraph 2>/dev/null; node --version; ls ~/.claude/projects/-Users-dev-invoices/memory/ 2>/dev/null"},
      {"at": 17.9, "line": "Calling **1** tool, running **3** shell commands…", "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md"},
      {"at": 30.9, "line": "Calling **2** tools, running **3** shell commands…", "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md"},
      {"at": 101.9, "line": "Calling **3** tools, running **3** shell commands…", "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md"},
      {"at": 175.9, "line": "INV-1001 ($1,200, due Oct 15) becomes overdue on Oct 16. Which rule sets its late fee? The amounts are examples; pick Other to name your own rule or amount.", "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md"},
      {"at": 307.9, "line": "Where should the 1.5%-a-month rate and the 10% cap live? The choice decides what happens to unpaid invoices if the rate ever changes.", "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md"},
      {"at": 342.9, "line": "Editing **1** file +**32**, calling **5** tools, running **3** shell commands…", "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md"},
      {"at": 347.9, "line": "Editing **1** file +**32**, calling **6** tools, running **3** shell commands…", "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md"},
      {"at": 380.9, "line": "Tests for late interest: check it only through what an invoice owes, amountDue(invoice, today), and keep the interest math private to src/invoice.js?", "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md"},
      {"at": 400.9, "line": "Running baseline tests and computing test dates", "tool": "$ npm test 2>&1 | tail -12; node -e '\nconst add=(d,n)=>{const x=new Date(d+\"T00:00:00Z\");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};\nfor (const n of [30,31,61,120,121,180,181]) console.log(n, add(\"2026-10-15\",n));'"},
      {"at": 407.9, "line": "Writing first failing test for late interest and running", "tool": "$ cat > test/invoice.test.js <<'EOF'\nimport { test } from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { dueDate, isOverdue, amountDue } from \"../src/invoice.js\";\n\nconst inv = { id: \"INV-1001\", customerId: \"c-7\", issuedOn: \"2026-10-01\", termsDays: 14, totalCents: 120000, paidOn: null,\n  lateInterestTerms: { monthlyBps: 150, capBps: 1000 } };\n\ntest(\"due date is the issue date plus the terms\", () => {\n  assert.equal(dueDate(inv), \"2026-10-15\");\n});\n\ntest(\"an unpaid invoice is overdue the day after its due date\", () => {\n  assert.equal(isOverdue(inv, \"2026-10-15\"), false);\n  assert.equal(isOverdue(inv, \"2026-10-16\"), true);\n});\n\ntest(\"a paid invoice owes nothing and is never overdue\", () => {\n  const paid = { ...inv, paidOn: \"2026-10-20\" };\n  assert.equal(amountDue(paid, \"2026-11-01\"), 0);\n  assert.equal(isOverdue(paid, \"2026-11-01\"), false);\n});\n\ntest(\"late interest starts the day an invoice becomes overdue, at the invoice's own monthly rate\", () => {\n  assert.equal(amountDue(inv, \"2026-10-15\"), 120000);\n  assert.equal(amountDue(inv, \"2026-10-16\"), 121800);\n  const at2Percent = { ...inv, lateInterestTerms: { monthlyBps: 200, capBps: 1000 } };\n  assert.equal(amountDue(at2Percent, \"2026-10-16\"), 122400);\n});\nEOF\nnpm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 412.9, "line": "Writing first failing test for late interest and running", "tool": "$ npm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 415.9, "line": "Adding second failing test for monthly accrual and running", "tool": "$ cat >> test/invoice.test.js <<'EOF'\n\ntest(\"each started 30 days overdue adds another month of late interest, without compounding\", () => {\n  assert.equal(amountDue(inv, \"2026-11-14\"), 121800);\n  assert.equal(amountDue(inv, \"2026-11-15\"), 123600);\n  assert.equal(amountDue(inv, \"2026-12-15\"), 125400);\n});\nEOF\nnpm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 418.9, "line": "Adding second failing test for monthly accrual and running", "tool": "$ npm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 423.9, "line": "Adding failing cap test and running", "tool": "$ cat >> test/invoice.test.js <<'EOF'\n\ntest(\"late interest stops at the invoice's cap, a share of its total\", () => {\n  assert.equal(amountDue(inv, \"2027-04-13\"), 130800);\n  assert.equal(amountDue(inv, \"2027-04-14\"), 132000);\n  const cappedAt5Percent = { ...inv, lateInterestTerms: { monthlyBps: 150, capBps: 500 } };\n  assert.equal(amountDue(cappedAt5Percent, \"2027-02-12\"), 126000);\n});\nEOF\nnpm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 427.9, "line": "Adding failing cap test and running", "tool": "$ npm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 430.9, "line": "Adding failing cap test and running", "tool": "$ cat >> test/invoice.test.js <<'EOF'\n\ntest(\"late interest rounds down to whole cents\", () => {\n  const odd = { ...inv, totalCents: 123457 };\n  assert.equal(amountDue(odd, \"2026-10-16\"), 125308);\n  assert.equal(amountDue(odd, \"2027-04-14\"), 135802);\n});\nEOF\nnpm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 431.9, "line": "Adding failing rounding test and running", "tool": "$ cat >> test/invoice.test.js <<'EOF'\n\ntest(\"late interest rounds down to whole cents\", () => {\n  const odd = { ...inv, totalCents: 123457 };\n  assert.equal(amountDue(odd, \"2026-10-16\"), 125308);\n  assert.equal(amountDue(odd, \"2027-04-14\"), 135802);\n});\nEOF\nnpm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 434.9, "line": "Adding failing rounding test and running", "tool": "$ npm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected'"},
      {"at": 438.9, "line": "Adding failing missing-terms test and running", "tool": "$ cat >> test/invoice.test.js <<'EOF'\n\ntest(\"an unpaid invoice without whole-number late interest terms is rejected\", () => {\n  const noTerms = { ...inv, lateInterestTerms: undefined };\n  assert.throws(() => amountDue(noTerms, \"2026-10-01\"), /INV-1001.*lateInterestTerms/);\n  const noCap = { ...inv, lateInterestTerms: { monthlyBps: 150 } };\n  assert.throws(() => amountDue(noCap, \"2026-10-16\"), /INV-1001.*lateInterestTerms/);\n});\nEOF\nnpm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected|Missing expected'"},
      {"at": 443.9, "line": "Adding failing missing-terms test and running", "tool": "$ cat -n src/invoice.js"},
      {"at": 448.9, "line": "Running tests after adding the terms check", "tool": "$ npm test 2>&1 | grep -E '^(not ok|ok|# (pass|fail))|actual|expected|Missing expected'"},
      {"at": 462.9, "line": "Running tests and showing the full diff", "tool": "$ npm test 2>&1 | grep -E '^# (pass|fail)' && git status --short && git diff"},
      {"at": 516.9, "line": "Rerunning tests and checking zero terms charge no interest", "tool": "$ npm test 2>&1 | grep -E '^# (pass|fail)' && node --input-type=module -e '\nimport { amountDue } from \"./src/invoice.js\";\nconst inv = { id: \"INV-1001\", issuedOn: \"2026-10-01\", termsDays: 14, totalCents: 120000, paidOn: null, lateInterestTerms: { monthlyBps: 0, capBps: 0 } };\nconsole.log(amountDue(inv, \"2026-10-16\"), amountDue(inv, \"2027-06-01\"));'"},
    ],
    launches: [
      {"at": 15.797, "skill": "mattpocock-skills:domain-modeling"},
      {"at": 31.109, "skill": "show-me:show-me"},
      {"at": 342.516, "skill": "mattpocock-skills:tdd"},
    ],
    dialogs: [
      {
        "at": [
          108.4,
          175.0
        ],
        "after": 7,
        "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md",
        "questions": [
          {
            "header": "Fee rule",
            "question": "INV-1001 ($1,200, due Oct 15) becomes overdue on Oct 16. Which rule sets its late fee? The amounts are examples; pick Other to name your own rule or amount.",
            "multiSelect": false,
            "options": [
              {
                "label": "Flat fee, once",
                "description": "One fixed charge the day the invoice becomes overdue. It never grows.",
                "preview": "INV-1001 · $1,200.00 · due 2026-10-15\nrule: $25 once, when overdue\n\ndate        fee       owed\n2026-10-15  $0        $1,200.00\n2026-10-16  $25.00    $1,225.00\n2026-11-15  $25.00    $1,225.00\n2026-12-15  $25.00    $1,225.00"
              },
              {
                "label": "Percent fee, once",
                "description": "One charge, a share of the invoice total, the day it becomes overdue. It never grows.",
                "preview": "INV-1001 · $1,200.00 · due 2026-10-15\nrule: 5% of total once, when overdue\n\ndate        fee       owed\n2026-10-15  $0        $1,200.00\n2026-10-16  $60.00    $1,260.00\n2026-11-15  $60.00    $1,260.00\n2026-12-15  $60.00    $1,260.00"
              },
              {
                "label": "Percent per month",
                "description": "A share of the total for each started 30 days overdue. It grows, so it is interest, not a fee; the glossary will say so.",
                "preview": "INV-1001 · $1,200.00 · due 2026-10-15\nrule: 1.5% of total per started\n      30 days overdue (no compounding)\n\ndate        days late  fee      owed\n2026-10-15  0          $0       $1,200.00\n2026-10-16  1          $18.00   $1,218.00\n2026-11-15  31         $36.00   $1,236.00\n2026-12-15  61         $54.00   $1,254.00"
              },
              {
                "label": "Flat fee per month",
                "description": "A fixed charge for each started 30 days overdue. It grows with time.",
                "preview": "INV-1001 · $1,200.00 · due 2026-10-15\nrule: $25 per started 30 days overdue\n\ndate        days late  fee      owed\n2026-10-15  0          $0       $1,200.00\n2026-10-16  1          $25.00   $1,225.00\n2026-11-15  31         $50.00   $1,250.00\n2026-12-15  61         $75.00   $1,275.00"
              }
            ],
            "picked": [
              2
            ],
            "notes": "1.5% a month, capped at 10% of the invoice total."
          }
        ]
      },
      {
        "at": [
          237.4,
          307.3
        ],
        "after": 8,
        "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md",
        "questions": [
          {
            "header": "Rate lives",
            "question": "Where should the 1.5%-a-month rate and the 10% cap live? The choice decides what happens to unpaid invoices if the rate ever changes.",
            "multiSelect": false,
            "options": [
              {
                "label": "In code (Recommended)",
                "description": "One rule for all invoices. Invoice data stays as it is. A later rate change applies to every unpaid overdue invoice, old ones too.",
                "preview": "src/invoice.js\n  monthly rate 1.5%, cap 10%  (one rule)\n\ninvoice = { id, customerId, issuedOn,\n            termsDays, totalCents, paidOn }\n\nRate changes to 2% next year:\n  INV-1001, issued at 1.5%, still unpaid\n  -> accrues 2% from then on"
              },
              {
                "label": "On each invoice",
                "description": "Each invoice keeps the rate it was issued under, the way it keeps its payment terms. Whatever creates invoices, outside this repo, must set the new fields.",
                "preview": "invoice = { id, customerId, issuedOn,\n            termsDays, totalCents, paidOn,\n            lateInterest: { monthly: 1.5%,\n                            cap: 10% } }\n\nRate changes to 2% next year:\n  INV-1001 keeps 1.5%\n  new invoices carry 2%"
              }
            ],
            "picked": [
              1
            ]
          },
          {
            "header": "Rounding",
            "question": "1.5% of a $1,234.57 invoice is $18.51855. How should late interest round to whole cents?",
            "multiSelect": false,
            "options": [
              {
                "label": "Round down (Recommended)",
                "description": "Never charges above the stated rate or the cap.",
                "preview": "$1,234.57 invoice\n\n1 month late   1.5%  $18.51855 -> $18.51\ncap            10%   $123.457  -> $123.45"
              },
              {
                "label": "Nearest cent",
                "description": "Half a cent or more rounds up, so the charge can land a fraction of a cent above the cap.",
                "preview": "$1,234.57 invoice\n\n1 month late   1.5%  $18.51855 -> $18.52\ncap            10%   $123.457  -> $123.46"
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      },
      {
        "at": [
          351.5,
          380.3
        ],
        "after": 11,
        "tool": "$ cd ~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.2.0/skills/engineering/domain-modeling && ls && cat CONTEXT-FORMAT.md",
        "questions": [
          {
            "header": "Test seam",
            "question": "Tests for late interest: check it only through what an invoice owes, amountDue(invoice, today), and keep the interest math private to src/invoice.js?",
            "multiSelect": false,
            "options": [
              {
                "label": "amountDue only (Recommended)",
                "description": "One public function answers what is owed. The interest math can change without breaking tests.",
                "preview": "src/invoice.js exports\n  dueDate(invoice)\n  isOverdue(invoice, today)\n  amountDue(invoice, today)   <- tests here\n\ntest: amountDue(INV-1001, \"2026-10-16\")\n      === 121800   // $1,200 + $18"
              },
              {
                "label": "Also lateInterest",
                "description": "Export the interest amount on its own too, e.g. for a statement line. Tests check both.",
                "preview": "src/invoice.js exports\n  dueDate(invoice)\n  isOverdue(invoice, today)\n  lateInterest(invoice, today) <- tests\n  amountDue(invoice, today)    <- tests\n\ntest: lateInterest(INV-1001, \"2026-10-16\")\n      === 1800     // $18"
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 547.1,
    chrome: [
      [-24.1, {"context": "0%", "style": "hold:Plain"}],
      [-0.1, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Cooking"}}],
      [1.9, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": ""}}],
      [1.9, {"context": "4% · 35k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 138 tokens"}}],
      [2.9, {"context": "4% · 35k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 245 tokens"}}],
      [3.9, {"context": "4% · 35k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 255 tokens"}}],
      [3.9, {"context": "4% · 35k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 259 tokens"}}],
      [4.9, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 448 tokens"}}],
      [5.9, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 498 tokens"}}],
      [6.9, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 510 tokens"}}],
      [6.9, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 512 tokens"}}],
      [14.9, {"context": "4% · 36.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.2k tokens"}}],
      [15.9, {"context": "4% · 36.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.4k tokens"}}],
      [16.9, {"context": "4% · 36.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.5k tokens"}}],
      [17.9, {"context": "4% · 39.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.7k tokens"}}],
      [30.9, {"context": "4% · 40.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 2.7k tokens"}}],
      [30.9, {"context": "4% · 40.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 2.8k tokens"}}],
      [31.9, {"context": "4% · 40.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 2.9k tokens"}}],
      [32.9, {"context": "4% · 40.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 3.0k tokens"}}],
      [32.9, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 3.1k tokens"}}],
      [33.9, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 3.2k tokens"}}],
      [101.9, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 4.7k tokens"}}],
      [102.9, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 4.8k tokens"}}],
      [104.9, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 4.9k tokens"}}],
      [105.9, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 5.0k tokens"}}],
      [106.9, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 5.1k tokens"}}],
      [174.9, {"context": "4% · 44.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 5.5k tokens"}}],
      [230.9, {"context": "4% · 44.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 10.7k tokens"}}],
      [231.9, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 10.8k tokens"}}],
      [232.9, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 10.9k tokens"}}],
      [234.9, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 11.0k tokens"}}],
      [235.9, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 11.1k tokens"}}],
      [306.9, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 11.6k tokens"}}],
      [337.9, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 14.7k tokens"}}],
      [338.9, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 14.7k tokens"}}],
      [339.9, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 14.8k tokens"}}],
      [340.9, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 14.9k tokens"}}],
      [340.9, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 15.0k tokens"}}],
      [342.9, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 15.2k tokens"}}],
      [342.9, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 15.4k tokens"}}],
      [347.9, {"context": "6% · 58.4k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 16.0k tokens"}}],
      [348.9, {"context": "6% · 58.4k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 16.1k tokens"}}],
      [379.9, {"context": "6% · 58.4k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 16.4k tokens"}}],
      [399.9, {"context": "6% · 58.4k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.2k tokens"}}],
      [399.9, {"context": "6% · 59.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.2k tokens"}}],
      [400.9, {"context": "6% · 59.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.3k tokens"}}],
      [401.9, {"context": "6% · 59.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.4k tokens"}}],
      [402.9, {"context": "6% · 59.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.5k tokens"}}],
      [403.9, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.7k tokens"}}],
      [404.9, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.8k tokens"}}],
      [404.9, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.9k tokens"}}],
      [405.9, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.0k tokens"}}],
      [407.9, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.1k tokens"}}],
      [408.9, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.3k tokens"}}],
      [409.9, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.4k tokens"}}],
      [409.9, {"context": "6% · 62.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.4k tokens"}}],
      [410.9, {"context": "6% · 62.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.5k tokens"}}],
      [412.9, {"context": "6% · 62.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.6k tokens"}}],
      [412.9, {"context": "6% · 62.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.8k tokens"}}],
      [414.9, {"context": "6% · 63.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.0k tokens"}}],
      [415.9, {"context": "6% · 63.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.1k tokens"}}],
      [415.9, {"context": "6% · 63.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.2k tokens"}}],
      [417.9, {"context": "6% · 63.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.3k tokens"}}],
      [418.9, {"context": "6% · 64.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.3k tokens"}}],
      [419.9, {"context": "6% · 64.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.4k tokens"}}],
      [420.9, {"context": "6% · 64.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.6k tokens"}}],
      [421.9, {"context": "6% · 64.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.7k tokens"}}],
      [422.9, {"context": "6% · 64.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.9k tokens"}}],
      [422.9, {"context": "6% · 64.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.0k tokens"}}],
      [424.9, {"context": "6% · 64.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.1k tokens"}}],
      [425.9, {"context": "6% · 64.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.2k tokens"}}],
      [426.9, {"context": "7% · 65.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.2k tokens"}}],
      [427.9, {"context": "7% · 65.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.3k tokens"}}],
      [428.9, {"context": "7% · 65.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.5k tokens"}}],
      [430.9, {"context": "7% · 66.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.7k tokens"}}],
      [430.9, {"context": "7% · 66.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.9k tokens"}}],
      [433.9, {"context": "7% · 66.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.0k tokens"}}],
      [434.9, {"context": "7% · 66.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.1k tokens"}}],
      [435.9, {"context": "7% · 66.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.2k tokens"}}],
      [436.9, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.3k tokens"}}],
      [437.9, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.5k tokens"}}],
      [438.9, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.6k tokens"}}],
      [438.9, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.7k tokens"}}],
      [442.9, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.8k tokens"}}],
      [443.9, {"context": "7% · 68.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.0k tokens"}}],
      [443.9, {"context": "7% · 68.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.1k tokens"}}],
      [444.9, {"context": "7% · 68.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.2k tokens"}}],
      [446.9, {"context": "7% · 68.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.3k tokens"}}],
      [447.9, {"context": "7% · 69.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.4k tokens"}}],
      [448.9, {"context": "7% · 69.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.5k tokens"}}],
      [448.9, {"context": "7% · 69.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.7k tokens"}}],
      [450.9, {"context": "7% · 69.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.8k tokens"}}],
      [460.9, {"context": "7% · 70.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 24.8k tokens"}}],
      [461.9, {"context": "7% · 70.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 24.9k tokens"}}],
      [463.9, {"context": "7% · 70.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.1k tokens"}}],
      [464.9, {"context": "7% · 70.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.2k tokens"}}],
      [466.9, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.3k tokens"}}],
      [466.9, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.4k tokens"}}],
      [467.9, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.5k tokens"}}],
      [515.9, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.6k tokens"}}],
      [516.9, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.7k tokens"}}],
      [517.9, {"context": "7% · 74.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.8k tokens"}}],
      [518.9, {"context": "7% · 74.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.9k tokens"}}],
      [546.9, {"context": "7% · 74.8k", "style": "hold:Plain"}],
      [547.9, {"context": "8% · 75.4k", "style": "hold:Plain", "band": ["questions 3"]}],
      [576.9, {"context": "8% · 75.4k", "style": "hold:Plain", "spin": {"verb": "Grooving"}}],
    ],
    panes: {
      "questions": {
        chips: [],
        body: [
          [{"id": "title", "label": "questions", "kind": "title"}, {"id": "close", "label": "close", "kind": "line"}],
          [],
          [{"id": "question:0", "label": "• What terms do unpaid invoices from before this change get?", "kind": "title"}],
          [{"id": "answer:0:0", "label": "◦ 0/0: no late interest", "kind": "line", "indent": 2}],
          [{"id": "answer:0:1", "label": "◦ 150/1000: the new rule applies to them", "kind": "line", "indent": 2}],
          [],
          [{"id": "question:1", "label": "• Should amountDue reject a call with no date instead of charging no interest?", "kind": "title"}],
          [{"id": "answer:1:0", "label": "◦ Yes", "kind": "line", "indent": 2}],
          [{"id": "answer:1:1", "label": "◦ No", "kind": "line", "indent": 2}],
          [],
          [{"id": "question:2", "label": "• Write a decision record for keeping the rate on each invoice?", "kind": "title"}],
          [{"id": "answer:2:0", "label": "◦ Yes", "kind": "line", "indent": 2}],
          [{"id": "answer:2:1", "label": "◦ No", "kind": "line", "indent": 2}],
        ],
      },
    },
    reply: [
      "Overdue invoices now owe late interest.",
      "8 tests pass.",
      "Nothing is committed.",
      "",
      "| piece | status | note |",
      "|---|---|---|",
      "| late interest in `amountDue(invoice, today)` | tested | |",
      "| `CONTEXT.md` glossary | implemented | says late interest, not late fee |",
      "| unpaid invoices with no terms | implemented | `amountDue` throws, even before overdue |",
      "| `amountDue(invoice)` with no date | implemented | returns the total, no error |",
      "| invoice data from outside this repo | proposed | needs the field below |",
      "",
      "Whatever creates invoices must now set this field.",
      "",
      "```diff",
      " { id, customerId, issuedOn, termsDays, totalCents, paidOn,",
      "+  lateInterestTerms: { monthlyBps: 150, capBps: 1000 } }",
      "```",
      "",
      "Terms of 0/0 charge no interest.",
      "Next, I'll apply your choice once you answer.",
      "Your call: should unpaid invoices from before this change get 0/0 or 150/1000?",
    ],
    keys: [
      [
        -24.1,
        "type",
        "/compose Add a late fee to overdue invoices. /domain-modeling /tdd /show-me"
      ],
      [
        -13.5,
        "type",
        " "
      ],
      [
        -5.5,
        "key",
        "Enter"
      ],
      [
        138.7,
        "key",
        "Down"
      ],
      [
        154.6,
        "key",
        "Down"
      ],
      [
        155.4,
        "key",
        "n"
      ],
      [
        156.4,
        "type",
        "1.5% a month, capped at 10% of the invoice total."
      ],
      [
        173.0,
        "key",
        "Enter"
      ],
      [
        249.2,
        "key",
        "Down"
      ],
      [
        263.4,
        "key",
        "Enter"
      ],
      [
        288.5,
        "key",
        "Enter"
      ],
      [
        305.5,
        "key",
        "Enter"
      ],
      [
        378.8,
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
  {
    user: "0/0 for old invoices. Those customers never agreed to interest.",
    tools: "Called 1 tool",
    activity: [
      {"at": 21.7, "line": "Adding zero-terms test, sharpen glossary, running tests", "tool": "$ cat >> test/invoice.test.js <<'EOF'\n\ntest(\"an invoice whose customer agreed to no late interest owes only its total\", () => {\n  const noInterest = { ...inv, lateInterestTerms: { monthlyBps: 0, capBps: 0 } };\n  assert.equal(amountDue(noInterest, \"2027-06-01\"), 120000);\n});\nEOF\npython3 - <<'EOF'\np = \"CONTEXT.md\"\ns = open(p).read()\nold = \"The monthly rate and the cap an invoice was issued under. Each invoice keeps its own.\"\nnew = \"The monthly rate and the cap the customer agreed to for an invoice. Each invoice keeps its own; both are zero where the customer agreed to none.\"\nassert s.count(old) == 1\nopen(p, \"w\").write(s.replace(old, new))\nEOF\nnpm test 2>&1 | grep -E '^(not ok|# (pass|fail))'; grep -A2 'Late interest terms' CONTEXT.md"},
    ],
    replyAt: 34.5,
    chrome: [
      [-576.3, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Cooking"}}],
      [-575.3, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": ""}}],
      [-575.3, {"context": "4% · 35k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 138 tokens"}}],
      [-574.3, {"context": "4% · 35k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 245 tokens"}}],
      [-573.3, {"context": "4% · 35k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 255 tokens"}}],
      [-573.3, {"context": "4% · 35k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 259 tokens"}}],
      [-572.3, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 448 tokens"}}],
      [-571.3, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 498 tokens"}}],
      [-570.3, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 510 tokens"}}],
      [-570.3, {"context": "4% · 35.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 512 tokens"}}],
      [-562.3, {"context": "4% · 36.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.2k tokens"}}],
      [-561.3, {"context": "4% · 36.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.4k tokens"}}],
      [-560.3, {"context": "4% · 36.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.5k tokens"}}],
      [-559.3, {"context": "4% · 39.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 1.7k tokens"}}],
      [-546.3, {"context": "4% · 40.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 2.7k tokens"}}],
      [-546.3, {"context": "4% · 40.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 2.8k tokens"}}],
      [-545.3, {"context": "4% · 40.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 2.9k tokens"}}],
      [-544.3, {"context": "4% · 40.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 3.0k tokens"}}],
      [-544.3, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 3.1k tokens"}}],
      [-543.3, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 3.2k tokens"}}],
      [-475.3, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 4.7k tokens"}}],
      [-474.3, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 4.8k tokens"}}],
      [-472.3, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 4.9k tokens"}}],
      [-471.3, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 5.0k tokens"}}],
      [-470.3, {"context": "4% · 42.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 5.1k tokens"}}],
      [-402.3, {"context": "4% · 44.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 5.5k tokens"}}],
      [-346.3, {"context": "4% · 44.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 10.7k tokens"}}],
      [-345.3, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 10.8k tokens"}}],
      [-344.3, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 10.9k tokens"}}],
      [-342.3, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 11.0k tokens"}}],
      [-341.3, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 11.1k tokens"}}],
      [-270.3, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 11.6k tokens"}}],
      [-239.3, {"context": "5% · 46.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 14.7k tokens"}}],
      [-238.3, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 14.7k tokens"}}],
      [-237.3, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 14.8k tokens"}}],
      [-236.3, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 14.9k tokens"}}],
      [-236.3, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 15.0k tokens"}}],
      [-234.3, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 15.2k tokens"}}],
      [-234.3, {"context": "5% · 53.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 15.4k tokens"}}],
      [-229.3, {"context": "6% · 58.4k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 16.0k tokens"}}],
      [-228.3, {"context": "6% · 58.4k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 16.1k tokens"}}],
      [-197.3, {"context": "6% · 58.4k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 16.4k tokens"}}],
      [-177.3, {"context": "6% · 58.4k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.2k tokens"}}],
      [-177.3, {"context": "6% · 59.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.2k tokens"}}],
      [-176.3, {"context": "6% · 59.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.3k tokens"}}],
      [-175.3, {"context": "6% · 59.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.4k tokens"}}],
      [-174.3, {"context": "6% · 59.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.5k tokens"}}],
      [-173.3, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.7k tokens"}}],
      [-172.3, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.8k tokens"}}],
      [-172.3, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 18.9k tokens"}}],
      [-171.3, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.0k tokens"}}],
      [-169.3, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.1k tokens"}}],
      [-168.3, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.3k tokens"}}],
      [-167.3, {"context": "6% · 61.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.4k tokens"}}],
      [-167.3, {"context": "6% · 62.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.4k tokens"}}],
      [-166.3, {"context": "6% · 62.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.5k tokens"}}],
      [-164.3, {"context": "6% · 62.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.6k tokens"}}],
      [-164.3, {"context": "6% · 62.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 19.8k tokens"}}],
      [-162.3, {"context": "6% · 63.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.0k tokens"}}],
      [-161.3, {"context": "6% · 63.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.1k tokens"}}],
      [-161.3, {"context": "6% · 63.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.2k tokens"}}],
      [-159.3, {"context": "6% · 63.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.3k tokens"}}],
      [-158.3, {"context": "6% · 64.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.3k tokens"}}],
      [-157.3, {"context": "6% · 64.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.4k tokens"}}],
      [-156.3, {"context": "6% · 64.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.6k tokens"}}],
      [-155.3, {"context": "6% · 64.1k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.7k tokens"}}],
      [-154.3, {"context": "6% · 64.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 20.9k tokens"}}],
      [-154.3, {"context": "6% · 64.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.0k tokens"}}],
      [-152.3, {"context": "6% · 64.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.1k tokens"}}],
      [-151.3, {"context": "6% · 64.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.2k tokens"}}],
      [-150.3, {"context": "7% · 65.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.2k tokens"}}],
      [-149.3, {"context": "7% · 65.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.3k tokens"}}],
      [-148.3, {"context": "7% · 65.6k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.5k tokens"}}],
      [-146.3, {"context": "7% · 66.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.7k tokens"}}],
      [-146.3, {"context": "7% · 66.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 21.9k tokens"}}],
      [-143.3, {"context": "7% · 66.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.0k tokens"}}],
      [-142.3, {"context": "7% · 66.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.1k tokens"}}],
      [-141.3, {"context": "7% · 66.9k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.2k tokens"}}],
      [-140.3, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.3k tokens"}}],
      [-139.3, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.5k tokens"}}],
      [-138.3, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.6k tokens"}}],
      [-138.3, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.7k tokens"}}],
      [-134.3, {"context": "7% · 67.5k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 22.8k tokens"}}],
      [-133.3, {"context": "7% · 68.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.0k tokens"}}],
      [-133.3, {"context": "7% · 68.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.1k tokens"}}],
      [-132.3, {"context": "7% · 68.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.2k tokens"}}],
      [-130.3, {"context": "7% · 68.3k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.3k tokens"}}],
      [-129.3, {"context": "7% · 69.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.4k tokens"}}],
      [-128.3, {"context": "7% · 69.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.5k tokens"}}],
      [-128.3, {"context": "7% · 69.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.7k tokens"}}],
      [-126.3, {"context": "7% · 69.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 23.8k tokens"}}],
      [-116.3, {"context": "7% · 70.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 24.8k tokens"}}],
      [-115.3, {"context": "7% · 70.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 24.9k tokens"}}],
      [-113.3, {"context": "7% · 70.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.1k tokens"}}],
      [-112.3, {"context": "7% · 70.2k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.2k tokens"}}],
      [-110.3, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.3k tokens"}}],
      [-110.3, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.4k tokens"}}],
      [-109.3, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.5k tokens"}}],
      [-61.3, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.6k tokens"}}],
      [-60.3, {"context": "7% · 73.7k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.7k tokens"}}],
      [-59.3, {"context": "7% · 74.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.8k tokens"}}],
      [-58.3, {"context": "7% · 74.8k", "style": "hold:Plain", "spin": {"verb": "Marinating", "tail": "↓ 25.9k tokens"}}],
      [-30.3, {"context": "7% · 74.8k", "style": "hold:Plain"}],
      [-29.3, {"context": "8% · 75.4k", "style": "hold:Plain", "band": ["questions 3"]}],
      [-0.3, {"context": "8% · 75.4k", "style": "hold:Plain", "spin": {"verb": "Grooving"}}],
      [0.7, {"context": "8% · 75.4k", "style": "hold:Plain", "spin": {"verb": "Grooving", "tail": ""}}],
      [18.7, {"context": "8% · 78.6k", "style": "hold:Plain", "spin": {"verb": "Grooving", "tail": "↓ 1.8k tokens"}}],
      [20.7, {"context": "8% · 78.6k", "style": "hold:Plain", "spin": {"verb": "Grooving", "tail": "↓ 1.9k tokens"}}],
      [21.7, {"context": "8% · 78.6k", "style": "hold:Plain", "spin": {"verb": "Grooving", "tail": "↓ 2.0k tokens"}}],
      [22.7, {"context": "8% · 78.6k", "style": "hold:Plain", "spin": {"verb": "Grooving", "tail": "↓ 2.1k tokens"}}],
      [23.7, {"context": "8% · 78.6k", "style": "hold:Plain", "spin": {"verb": "Grooving", "tail": "↓ 2.2k tokens"}}],
      [34.7, {"context": "8% · 78.6k", "style": "hold:Plain", "band": ["questions 2"]}],
      [34.7, {"context": "8% · 81.3k", "style": "hold:Plain", "band": ["questions 2"]}],
    ],
    panes: {
      "questions": {
        chips: [],
        body: [
          [{"id": "title", "label": "questions", "kind": "title"}, {"id": "close", "label": "close", "kind": "line"}],
          [],
          [{"id": "question:0", "label": "• Should amountDue reject a call with no date instead of charging no interest?", "kind": "title"}],
          [{"id": "answer:0:0", "label": "◦ Yes", "kind": "line", "indent": 2}],
          [{"id": "answer:0:1", "label": "◦ No", "kind": "line", "indent": 2}],
          [],
          [{"id": "question:1", "label": "• Write a decision record for keeping each customer's agreed rate on the invoice?", "kind": "title"}],
          [{"id": "answer:1:0", "label": "◦ Yes", "kind": "line", "indent": 2}],
          [{"id": "answer:1:1", "label": "◦ No", "kind": "line", "indent": 2}],
        ],
      },
    },
    reply: [
      "Old invoices get 0/0.",
      "",
      "| piece | status | note |",
      "|---|---|---|",
      "| 0/0 test: terms owe only the total | tested | 9 pass |",
      "| 0/0 code | unchanged | already charges nothing |",
      "| glossary: late interest terms | implemented | now \"what the customer agreed to\" |",
      "",
      "Before you ship, set 0/0 on old unpaid invoices.",
      "Otherwise `amountDue` throws on them.",
    ],
    keys: [
      [
        -1.7,
        "type",
        "0/0 for old invoices. Those customers never agreed to interest."
      ],
      [
        -0.7,
        "key",
        "Enter"
      ]
    ],
  },
];
