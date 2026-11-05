import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:clarify Add a retry to our webhook consumer, unsure about idempotency",
    tools: "Called 1 tool, ran 1 shell command",
    activity: [
      {"at": 2.3, "line": "Listing and printing repo source files", "tool": "$ git ls-files && echo ---- && for f in $(git ls-files | grep -v -E 'lock|\\.json$'); do echo \"=== $f\"; cat \"$f\"; done"},
      {"at": 565.3, "line": "The retry goes on failed fulfil-order jobs in src/queue/jobs.ts: Payflow already retries the webhook itself for three days (consumer.ts). Today a Payflow redelivery already makes a second fulfilment order (no unique key on event or payment). What should this change cover?", "tool": "$ git ls-files && echo ---- && for f in $(git ls-files | grep -v -E 'lock|\\.json$'); do echo \"=== $f\"; cat \"$f\"; done"},
    ],
    dialogs: [
      {
        "at": [
          45.8,
          564.4
        ],
        "after": 1,
        "tool": "$ git ls-files && echo ---- && for f in $(git ls-files | grep -v -E 'lock|\\.json$'); do echo \"=== $f\"; cat \"$f\"; done",
        "questions": [
          {
            "header": "Scope",
            "question": "The retry goes on failed fulfil-order jobs in src/queue/jobs.ts: Payflow already retries the webhook itself for three days (consumer.ts). Today a Payflow redelivery already makes a second fulfilment order (no unique key on event or payment). What should this change cover?",
            "multiSelect": false,
            "options": [
              {
                "label": "Retry + dedupe (Recommended)",
                "description": "Retry jobs that throw, and drop repeat Payflow deliveries by event id so each payment makes one order.",
                "preview": "jobs: + attempts, run_after\n      + unique (event_id)\nworker: on throw -> requeue with backoff,\n        failed after N tries\nintake: same event id -> 202, no new job\norders: + unique (payment_id)"
              },
              {
                "label": "Retry only",
                "description": "Retry jobs that throw; leave duplicate Payflow deliveries as they are.",
                "preview": "jobs: + attempts, run_after\nworker: on throw -> requeue with backoff,\n        failed after N tries"
              },
              {
                "label": "Retry + dedupe + crash",
                "description": "Also requeue jobs stuck in 'running' after a process crash; today nothing picks them up.",
                "preview": "jobs: + attempts, run_after, locked_at\n      + unique (event_id)\nworker: on throw -> requeue with backoff\nsweeper: running and locked_at too old\n         -> queued\norders: + unique (payment_id)"
              }
            ],
            "picked": [
              0
            ]
          },
          {
            "header": "Fulfilment",
            "question": "fulfilment.ts times out after 5s, but fulfilment may have created the order anyway; a retry then makes a duplicate. Does fulfilment's POST /orders accept an idempotency key, or let us look up an order by payment id?",
            "multiSelect": false,
            "options": [
              {
                "label": "Accepts a key",
                "description": "We send the payment id as the key; retries are safe end to end.",
                "preview": "POST /orders\nIdempotency-Key: <payment.id>"
              },
              {
                "label": "Has a lookup",
                "description": "Before each retry we ask fulfilment whether the order exists.",
                "preview": "GET /orders?payment_id=<id>\n  found -> record it, skip POST\n  none  -> POST /orders"
              },
              {
                "label": "Neither",
                "description": "A timeout can still double-order; we retry anyway and only guard our own insert.",
                "preview": "retry on timeout -> may duplicate\nunique (payment_id) guards our table only"
              },
              {
                "label": "Don't know",
                "description": "I need to check with the fulfilment team first; the build waits on this.",
                "preview": "blocked on fulfilment team"
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 569.5,
    chrome: [
      [-6.7, {"context": "0%", "style": "hold:Plain"}],
      [0.3, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Determining"}}],
      [1.3, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 25 tokens · thinking with medium effort"}}],
      [1.3, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 165 tokens · thinking with medium effort"}}],
      [2.3, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 221 tokens · thought for 1s"}}],
      [3.3, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 232 tokens · thought for 1s"}}],
      [3.3, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 232 tokens · thinking with medium effort"}}],
      [10.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 813 tokens · thought for 6s"}}],
      [12.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 813 tokens"}}],
      [37.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 813 tokens · thinking with medium effort"}}],
      [37.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 901 tokens · thinking with medium effort"}}],
      [38.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.0k tokens · thinking with medium effort"}}],
      [39.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.1k tokens · thought for 1s"}}],
      [39.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.2k tokens · thought for 1s"}}],
      [40.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.2k tokens"}}],
      [41.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.3k tokens"}}],
      [42.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.4k tokens"}}],
      [44.3, {"context": "4% · 40.7k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.5k tokens"}}],
      [564.3, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.9k tokens"}}],
      [565.3, {"context": "4% · 42.2k", "style": "hold:Plain", "spin": {"verb": "Stewing", "tail": "↓ 1.9k tokens · thinking with medium effort"}}],
      [569.3, {"context": "4% · 43.6k", "style": "hold:Plain"}],
    ],
    reply: [
      "Confirmed.",
      "",
      "| Piece | What it builds |",
      "|---|---|",
      "| Worker retry (`src/queue/jobs.ts`) | Requeue a throwing job with a growing delay |",
      "| Worker retry (`src/queue/jobs.ts`) | Mark a job failed after N tries |",
      "| Intake dedupe (`consumer.ts`, `jobs`) | Unique key on event id |",
      "| Intake dedupe (`consumer.ts`, `jobs`) | Repeat delivery gets 202 and creates no job |",
      "| Our table (`orders`) | Unique key on `payment_id` |",
      "| Fulfilment call (`fulfilment.ts`) | Send `Idempotency-Key: <payment.id>` |",
      "| Fulfilment call (`fulfilment.ts`) | Retry after a timeout creates no second order |",
      "",
      "Payflow already retries the webhook itself, so the handler gets no retry of its own.",
      "Next: I write the tests and the change on a new branch, if you say go.",
    ],
    keys: [
      [
        -1.9,
        "type",
        "/hope:clarify Add a retry to our webhook consumer, unsure about idempotency"
      ],
      [
        -0.1,
        "key",
        "Enter"
      ],
      [
        478.5,
        "key",
        "Enter"
      ],
      [
        556.7,
        "key",
        "Enter"
      ],
      [
        564.4,
        "key",
        "Enter"
      ]
    ],
  },
];
