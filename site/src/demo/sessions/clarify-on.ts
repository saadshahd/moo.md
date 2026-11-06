import type { Chrome, Turn } from "../types";

export const chrome: Chrome = {"context": "0%", "style": "hold:Plain"};

export const turns: Turn[] = [
  {
    user: "/hope:clarify Retry failed fulfilment orders, unsure about idempotency",
    tools: "Called 1 tool, ran 1 shell command",
    activity: [
      {"at": 3.9, "line": "Listing files and read schema and source", "tool": "$ git ls-files && cat db/schema.sql && cat src/*.ts src/*/*.ts 2>/dev/null | head -400"},
      {"at": 58.9, "line": "Which retry do you mean? Note: fulfilment's POST /orders makes a new order on every call (src/clients/fulfilment.ts), so any retry after a timeout can ship twice.", "tool": "$ git ls-files && cat db/schema.sql && cat src/*.ts src/*/*.ts 2>/dev/null | head -400"},
    ],
    dialogs: [
      {
        "at": [
          18.8,
          57.9
        ],
        "after": 1,
        "tool": "$ git ls-files && cat db/schema.sql && cat src/*.ts src/*/*.ts 2>/dev/null | head -400",
        "questions": [
          {
            "header": "Retry kind",
            "question": "Which retry do you mean? Note: fulfilment's POST /orders makes a new order on every call (src/clients/fulfilment.ts), so any retry after a timeout can ship twice.",
            "multiSelect": false,
            "options": [
              {
                "label": "Worker retries itself",
                "description": "Queue retries a failed fulfil-order job with backoff, up to N tries, then marks it failed. Needs a guard so a retry never makes a second fulfilment order.",
                "preview": "jobs: + attempts int, + run_after timestamptz\nwork(): on throw →\n  attempts < N ? requeue with backoff : 'failed'\nfulfilOrder: skip if orders has payment_id"
              },
              {
                "label": "Replay stuck failed jobs",
                "description": "A command you run by hand that requeues jobs already in state 'failed'. Same guard needed so a replay never makes a second order.",
                "preview": "npm run requeue-failed [--id 42]\n  update jobs set state='queued'\n  where state='failed' and kind='fulfil-order'\nfulfilOrder: skip if orders has payment_id"
              },
              {
                "label": "Dedupe Payflow redelivery",
                "description": "Not new retries: make the same Payflow event id enqueue and fulfil once, since Payflow resends anything we don't 2xx for three days.",
                "preview": "jobs: + unique (kind, payload->>'eventId')\nenqueue: on conflict do nothing → 202\norders: + unique (payment_id)"
              }
            ],
            "picked": [
              0
            ]
          }
        ]
      }
    ],
    replyAt: 64.8,
    chrome: [
      [-3.1, {"context": "0%", "style": "hold:Plain"}],
      [-1.1, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Nesting"}}],
      [1.9, {"context": "0%", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": ""}}],
      [2.9, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 155 tokens"}}],
      [3.9, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 208 tokens"}}],
      [4.9, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 218 tokens"}}],
      [4.9, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 219 tokens"}}],
      [13.9, {"context": "4% · 38k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 789 tokens"}}],
      [13.9, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 818 tokens"}}],
      [14.9, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 880 tokens"}}],
      [15.9, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 917 tokens"}}],
      [16.9, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 960 tokens"}}],
      [16.9, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 1.0k tokens"}}],
      [57.9, {"context": "4% · 40k", "style": "hold:Plain", "spin": {"verb": "Crafting", "tail": "↓ 1.4k tokens"}}],
      [64.9, {"context": "4% · 40k", "style": "hold:Plain"}],
      [64.9, {"context": "4% · 41.4k", "style": "hold:Plain", "band": ["questions 2"]}],
    ],
    panes: {
      "questions": {
        chips: [],
        body: [
          [{"id": "title", "label": "questions", "kind": "title"}, {"id": "close", "label": "close", "kind": "line"}],
          [],
          [{"id": "question:0", "label": "• Does fulfilment's POST /orders accept an idempotency key?", "kind": "title"}],
          [{"id": "answer:0:0", "label": "◦ Yes", "kind": "line", "indent": 2}],
          [{"id": "answer:0:1", "label": "◦ No", "kind": "line", "indent": 2}],
          [{"id": "answer:0:2", "label": "◦ Unknown, I'll ask", "kind": "line", "indent": 2}],
          [],
          [{"id": "question:1", "label": "• How many attempts, and what backoff?", "kind": "title"}],
          [{"id": "answer:1:0", "label": "◦ 5 tries, exponential from 30s", "kind": "line", "indent": 2}],
          [{"id": "answer:1:1", "label": "◦ 3 tries, fixed 1 min", "kind": "line", "indent": 2}],
          [{"id": "answer:1:2", "label": "◦ Other", "kind": "line", "indent": 2}],
        ],
      },
    },
    reply: [
      "The ask: when a fulfil-order job fails, the worker retries it with backoff up to N times, then marks it failed. A retry must never make a second fulfilment order.",
      "",
      "That guard has a gap. If fulfilment creates the order but times out before replying, `orders` has no row, so a retry ships twice.",
      "",
      "Only an idempotency key on fulfilment's POST /orders closes that. I can't see from here whether fulfilment accepts one.",
      "",
      "Next: I'll check with the fulfilment team whether POST /orders takes an idempotency key. Then you pick N and the backoff.",
    ],
    keys: [
      [
        -2.4,
        "type",
        "/hope:clarify Retry failed fulfilment orders, unsure about idempotency"
      ],
      [
        -0.5,
        "key",
        "Enter"
      ],
      [
        57.9,
        "key",
        "Enter"
      ]
    ],
  },
];
