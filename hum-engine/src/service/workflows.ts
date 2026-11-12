import { stringify } from "yaml";
import { CLAUDE_FLOOR } from "../adapters/claude-p.ts";
import type { HumConfig } from "../config/schema.ts";

/** The settings the workflows are built from. */
export type WorkflowSettings = Pick<HumConfig, "runBranchPrefix" | "itemsDir" | "ciSchedule" | "commitIdentity" | "ciWakeTimeoutMinutes" | "pullRequestTokenSecret">;

const WAKE_FILE = "hum-wake.yml";

/** The type of the `repository_dispatch` event a tracker's webhook sends. */
const DISPATCH_EVENT = "hum-wake";

const WAKE_PATH = `./.github/workflows/${WAKE_FILE}`;

const TOKEN_SECRET = "CLAUDE_CODE_OAUTH_TOKEN";

const HOPE_MARKETPLACE = "saadshahd/moo.md";

/** The Bun that builds the workflows is the one the owner's repo runs, so CI installs with the same lockfile reader. */
const BUN_VERSION = Bun.version;

const ACTIONS = { checkout: "actions/checkout@v4", setupBun: "oven-sh/setup-bun@v2" } as const;

const PERMISSIONS = { contents: "write", issues: "write", "pull-requests": "write" } as const;

/** One wake at a time: a second event waits for the first run instead of racing it. */
const CONCURRENCY = { group: "hum-wake", "cancel-in-progress": false } as const;

/** The events a trigger workflow starts on. */
type TriggerEvents = {
	readonly issue_comment?: { readonly types: readonly string[] };
	readonly push?: { readonly branches: readonly string[]; readonly paths: readonly string[] };
	readonly repository_dispatch?: { readonly types: readonly string[] };
	readonly schedule?: readonly { readonly cron: string }[];
	readonly workflow_dispatch?: null;
};

type TriggerJob = { readonly if?: string };

/** A workflow that only chooses what starts the shared wake job. */
const trigger = (name: string, on: TriggerEvents, job: TriggerJob = {}) => ({
	name,
	on,
	permissions: PERMISSIONS,
	concurrency: CONCURRENCY,
	jobs: { wake: { ...job, uses: WAKE_PATH, secrets: "inherit" } },
});

/**
 * The job every wake runs. A run clones the repo again into a temp folder, so the git credentials and identity are
 * global: the checkout's own are local to its workspace. A run that needs the owner has pushed its run branch, asked
 * on the item and ended; the owner's answer starts a fresh run on that branch, so no session, artifact or approval
 * is kept between runs.
 */
const wake = ({ commitIdentity, ciWakeTimeoutMinutes, pullRequestTokenSecret }: WorkflowSettings) => ({
	name: "hum wake",
	on: { workflow_call: { secrets: { [TOKEN_SECRET]: { required: true }, [pullRequestTokenSecret]: { required: false } } } },
	permissions: PERMISSIONS,
	jobs: {
		wake: {
			"runs-on": "ubuntu-latest",
			"timeout-minutes": ciWakeTimeoutMinutes,
			env: {
				[TOKEN_SECRET]: `\${{ secrets.${TOKEN_SECRET} }}`,
				GH_TOKEN: `\${{ secrets.${pullRequestTokenSecret} || github.token }}`,
				HUM_EVENT: "${{ github.event_name }}",
			},
			steps: [
				{ uses: ACTIONS.checkout, with: { "fetch-depth": 0 } },
				{ uses: ACTIONS.setupBun, with: { "bun-version": BUN_VERSION } },
				{ run: "bun install --frozen-lockfile" },
				{ run: `npm install --global @anthropic-ai/claude-code@${CLAUDE_FLOOR}` },
				{ run: `claude plugin marketplace add ${HOPE_MARKETPLACE}\nclaude plugin install hope@moo.md\n` },
				{ run: "gh auth setup-git" },
				{
					run: 'git config --global user.name "$HUM_GIT_NAME"\ngit config --global user.email "$HUM_GIT_EMAIL"\n',
					env: { HUM_GIT_NAME: commitIdentity.name, HUM_GIT_EMAIL: commitIdentity.email },
				},
				{ run: './node_modules/.bin/hum wake --event "$HUM_EVENT"' },
			],
		},
	},
});

const WORKFLOWS = {
	[WAKE_FILE]: wake,
	"hum-comment.yml": () => trigger("hum on comment", { issue_comment: { types: ["created"] } }, { if: "github.event.comment.user.type != 'Bot'" }),
	"hum-push.yml": ({ itemsDir, runBranchPrefix }) => trigger("hum on item push", { push: { branches: ["**", `!${runBranchPrefix}**`], paths: [`${itemsDir}/**`] } }),
	"hum-dispatch.yml": () => trigger("hum on dispatch", { repository_dispatch: { types: [DISPATCH_EVENT] } }),
	"hum-schedule.yml": ({ ciSchedule }) => trigger("hum on schedule", { schedule: [{ cron: ciSchedule }], workflow_dispatch: null }),
} as const satisfies Record<string, (settings: WorkflowSettings) => object>;

export type WorkflowFile = { readonly file: string; readonly text: string };

/** The workflow files for an owner's repo, each named for `.github/workflows/`. */
export const ciWorkflows = (settings: WorkflowSettings): WorkflowFile[] =>
	Object.entries(WORKFLOWS).map(([file, build]) => ({ file, text: stringify(build(settings), { lineWidth: 0 }) }));
