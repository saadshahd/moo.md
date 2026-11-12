import { stringify } from "yaml";
import { CLAUDE_FLOOR } from "../adapters/claude-p.ts";
import type { HumConfig, PullRequestToken } from "../config/schema.ts";

/** The settings the workflows are built from. */
export type WorkflowSettings = Pick<
	HumConfig,
	"runBranchPrefix" | "itemsDir" | "ciSchedule" | "commitIdentity" | "ciWakeTimeoutMinutes" | "pullRequestToken" | "ciRunner" | "ciContainer" | "ciEnv" | "ciClaudeAuth"
>;

const WAKE_FILE = "hum-wake.yml";

/** The type of the `repository_dispatch` event a tracker's webhook sends. */
const DISPATCH_EVENT = "hum-wake";

const WAKE_PATH = `./.github/workflows/${WAKE_FILE}`;

const HOPE_MARKETPLACE = "saadshahd/moo.md";

/** The Bun that builds the workflows is the one the owner's repo runs, so CI installs with the same lockfile reader. */
const BUN_VERSION = Bun.version;

/** The action that mints a GitHub App's token, named without its version. */
export const APP_TOKEN_ACTION = "actions/create-github-app-token";

const ACTIONS = { checkout: "actions/checkout@v4", appToken: `${APP_TOKEN_ACTION}@v3` } as const;

const PERMISSIONS = { contents: "write", issues: "write", "pull-requests": "write" } as const;

/** One wake at a time: a second event waits for the first run instead of racing it. */
const CONCURRENCY = { group: "hum-wake", "cancel-in-progress": false } as const;

/** The secret Claude Code's OAuth token is stored in, under the env name Claude Code reads it from. */
export const CLAUDE_TOKEN = "CLAUDE_CODE_OAUTH_TOKEN";

/** The env the wake job sets itself. */
const ENV = {
	claudeToken: CLAUDE_TOKEN,
	githubToken: "GH_TOKEN",
	event: "HUM_EVENT",
	/** Whether the App's client ID secret is set, because a step's `if` cannot read a secret. */
	hasApp: "HUM_HAS_APP",
	gitName: "HUM_GIT_NAME",
	gitEmail: "HUM_GIT_EMAIL",
	/** Set from env, so no shell expands the token's name before git runs the helper. */
	gitCredentialHelper: "HUM_GIT_CREDENTIAL_HELPER",
} as const;

/** The env names the wake job sets itself, which `ciEnv` may not set. */
export const WAKE_OWN_ENV: ReadonlySet<string> = new Set(Object.values(ENV));

const APP_TOKEN_STEP = "app-token";

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

const secret = (name: string): string => `\${{ secrets.${name} }}`;

/** The secret and env Claude Code signs in with: the OAuth token, or none where `ciEnv` carries the credentials. */
const CLAUDE_SIGN_IN = {
	"oauth-token": { secrets: { [CLAUDE_TOKEN]: { required: true } }, env: { [CLAUDE_TOKEN]: secret(CLAUDE_TOKEN) } },
	env: { secrets: {}, env: {} },
} as const satisfies Record<HumConfig["ciClaudeAuth"], { readonly secrets: object; readonly env: object }>;

/**
 * The secrets a wake's GitHub token comes from, the env and steps that turn them into it, and the expression that
 * holds it. An App's token is minted with the workflow token's permissions, so both hold the same rights.
 */
const githubToken = (source: PullRequestToken) =>
	source.from === "secret"
		? { secrets: { [source.secret]: { required: false } }, env: {}, steps: [], token: `\${{ secrets.${source.secret} || github.token }}` }
		: {
				secrets: { [source.clientIdSecret]: { required: false }, [source.privateKeySecret]: { required: false } },
				env: { [ENV.hasApp]: `\${{ secrets.${source.clientIdSecret} != '' }}` },
				steps: [
					{
						id: APP_TOKEN_STEP,
						if: `env.${ENV.hasApp} == 'true'`,
						uses: ACTIONS.appToken,
						with: {
							"client-id": secret(source.clientIdSecret),
							"private-key": secret(source.privateKeySecret),
							...Object.fromEntries(Object.entries(PERMISSIONS).map(([scope, level]) => [`permission-${scope}`, level])),
						},
					},
				],
				token: `\${{ steps.${APP_TOKEN_STEP}.outputs.token || github.token }}`,
			};

/**
 * A run clones the repo again into a temp folder, so the git identity and credentials are global: the checkout's own
 * are local to its workspace. The credential helper hands git the token in the env when git asks, so git needs no
 * `gh`, which a job container may lack. In a job container the runner's user may own the checkout while the steps run
 * as root, and git refuses a repo another user owns until it is trusted.
 */
const gitSetup = ({ name, email }: HumConfig["commitIdentity"]) => ({
	run: `git config --global user.name "$${ENV.gitName}"
git config --global user.email "$${ENV.gitEmail}"
git config --global credential.https://github.com.helper "$${ENV.gitCredentialHelper}"
git config --global --add safe.directory "$GITHUB_WORKSPACE"
`,
	env: {
		[ENV.gitName]: name,
		[ENV.gitEmail]: email,
		[ENV.gitCredentialHelper]: `!f() { if [ "$1" = get ]; then echo username=x-access-token; echo "password=$${ENV.githubToken}"; fi; }; f`,
	},
});

/**
 * The job every wake runs. A run that needs the owner has pushed its run branch, asked on the item and ended; the
 * owner's answer starts a fresh run on that branch, so no session, artifact or approval is kept between runs. Bun and
 * Claude Code install through npm, so the job needs only git, node and npm from its runner or container. An App's
 * token lasts an hour, so it is minted last.
 */
const wake = ({ commitIdentity, ciWakeTimeoutMinutes, pullRequestToken, ciRunner, ciContainer, ciEnv, ciClaudeAuth }: WorkflowSettings) => {
	const claude = CLAUDE_SIGN_IN[ciClaudeAuth];
	const github = githubToken(pullRequestToken);

	return {
		name: "hum wake",
		on: { workflow_call: { secrets: { ...claude.secrets, ...github.secrets } } },
		permissions: PERMISSIONS,
		jobs: {
			wake: {
				"runs-on": ciRunner,
				// The YAML leaves out a key whose value is undefined, so a job with no container has no `container`.
				container: ciContainer ?? undefined,
				"timeout-minutes": ciWakeTimeoutMinutes,
				env: { ...ciEnv, ...claude.env, ...github.env, [ENV.event]: "${{ github.event_name }}" },
				steps: [
					{ uses: ACTIONS.checkout, with: { "fetch-depth": 0 } },
					{ run: `npm install --global bun@${BUN_VERSION} @anthropic-ai/claude-code@${CLAUDE_FLOOR}` },
					{ run: "bun install --frozen-lockfile" },
					{ run: `claude plugin marketplace add ${HOPE_MARKETPLACE}\nclaude plugin install hope@moo.md\n` },
					gitSetup(commitIdentity),
					...github.steps,
					{ run: `./node_modules/.bin/hum wake --event "$${ENV.event}"`, env: { [ENV.githubToken]: github.token } },
				],
			},
		},
	};
};

const WORKFLOWS = {
	[WAKE_FILE]: wake,
	"hum-comment.yml": () => trigger("hum on comment", { issue_comment: { types: ["created"] } }, { if: "github.event.comment.user.type != 'Bot'" }),
	"hum-push.yml": ({ itemsDir, runBranchPrefix }) => trigger("hum on item push", { push: { branches: ["**", `!${runBranchPrefix}**`], paths: [`${itemsDir}/**`] } }),
	"hum-dispatch.yml": () => trigger("hum on dispatch", { repository_dispatch: { types: [DISPATCH_EVENT] } }),
	"hum-schedule.yml": ({ ciSchedule }) => trigger("hum on schedule", { schedule: [{ cron: ciSchedule }], workflow_dispatch: null }),
} as const satisfies Record<string, (settings: WorkflowSettings) => object>;

/** The names of the workflow files hum writes. */
export const CI_WORKFLOW_FILES: ReadonlySet<string> = new Set(Object.keys(WORKFLOWS));

export type WorkflowFile = { readonly file: string; readonly text: string };

/** The workflow files for an owner's repo, each named for `.github/workflows/`. */
export const ciWorkflows = (settings: WorkflowSettings): WorkflowFile[] =>
	Object.entries(WORKFLOWS).map(([file, build]) => ({ file, text: stringify(build(settings), { lineWidth: 0 }) }));
