import { Document, visit } from "yaml";
import { CLAUDE_FLOOR } from "../adapters/claude-p.ts";
import type { HumConfig, PullRequestToken } from "../config/schema.ts";
import { APP_TOKEN_ACTION, CLAUDE_TOKEN, readsSecrets, secretsNamed, TRUSTED_ASSOCIATIONS, WAKE_ENV as ENV, WORKFLOW_FILES } from "../config/wake-job.ts";

/** The settings the workflows are built from. */
export type WorkflowSettings = Pick<
	HumConfig,
	"runBranchPrefix" | "itemsDir" | "ciSchedule" | "commitIdentity" | "ciWakeTimeoutMinutes" | "pullRequestToken" | "ciRunner" | "ciContainer" | "ciEnv" | "ciClaudeAuth"
>;

/** The type of the `repository_dispatch` event a tracker's webhook sends. */
const DISPATCH_EVENT = "hum-wake";

const WAKE_PATH = `./.github/workflows/${WORKFLOW_FILES.wake}`;

const HOPE_MARKETPLACE = "saadshahd/moo.md";

/** The Bun that builds the workflows is the one the owner's repo runs, so CI installs with the same lockfile reader. */
const BUN_VERSION = Bun.version;

/**
 * Each action the workflows run, at the one commit its release is. A tag can move to code that then holds the App's
 * private key and every secret of the job; a commit cannot. The release rides beside the commit as a comment.
 */
const ACTIONS = {
	checkout: { uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1", release: "v7.0.1" },
	appToken: { uses: `${APP_TOKEN_ACTION}@64ab729a6294000f5aa4a4bc0b73d1f32bc45510`, release: "v3.3.0" },
} as const;

const RELEASE_OF: ReadonlyMap<string, string> = new Map(Object.values(ACTIONS).map(({ uses, release }) => [uses, release]));

const PERMISSIONS = { contents: "write", issues: "write", "pull-requests": "write" } as const;

/** One wake at a time: a second event waits for the first run instead of racing it. */
const CONCURRENCY = { group: "hum-wake", "cancel-in-progress": false } as const;

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

/** The inputs that give an App's token the workflow's own permissions, each written out as the action names it. */
const APP_TOKEN_PERMISSIONS = {
	"permission-contents": PERMISSIONS.contents,
	"permission-issues": PERMISSIONS.issues,
	"permission-pull-requests": PERMISSIONS["pull-requests"],
} as const;

/** Where the job keeps what would else be machine-wide: a runner GitHub does not host keeps its home folder between jobs, and empties its temp folder after each. */
const JOB_TOOLS = "$RUNNER_TEMP/hum-tools";

/** Later steps read git's global config from the job's temp folder and find the job's own tools first on PATH. */
const JOB_PATHS_STEP = {
	run: `echo "${ENV.gitConfig}=$RUNNER_TEMP/hum-gitconfig" >> "$GITHUB_ENV"
echo "${JOB_TOOLS}/bin" >> "$GITHUB_PATH"
`,
} as const;

/** The YAML writer leaves out a key whose value is undefined, so a job that runs on the runner itself has no `container`. */
const NO_KEY = undefined;

const OPTIONAL_SECRET = { required: false } as const;

/** The secrets the owner's settings name. A called workflow reads only the secrets it declares, so each is declared, and none is required. */
const ownerSecrets = ({ ciRunner, ciContainer, ciEnv }: Pick<WorkflowSettings, "ciRunner" | "ciContainer" | "ciEnv">) =>
	Object.fromEntries(secretsNamed(ciRunner, ciContainer, ciEnv).map((name) => [name, OPTIONAL_SECRET]));

/** `ciEnv` split by reach: a value that reads a secret goes to the step that runs hum alone, so no install step holds it. */
const envByReach = (ciEnv: WorkflowSettings["ciEnv"]) => ({
	everyStep: Object.fromEntries(Object.entries(ciEnv).filter(([, value]) => !readsSecrets(value))),
	humStep: Object.fromEntries(Object.entries(ciEnv).filter(([, value]) => readsSecrets(value))),
});

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
		? { secrets: { [source.secret]: OPTIONAL_SECRET }, env: {}, steps: [], token: `\${{ secrets.${source.secret} || github.token }}` }
		: {
				secrets: { [source.clientIdSecret]: OPTIONAL_SECRET, [source.privateKeySecret]: OPTIONAL_SECRET },
				env: { [ENV.hasApp]: `\${{ secrets.${source.clientIdSecret} != '' }}` },
				steps: [
					{
						id: APP_TOKEN_STEP,
						if: `env.${ENV.hasApp} == 'true'`,
						uses: ACTIONS.appToken.uses,
						with: {
							"client-id": secret(source.clientIdSecret),
							"private-key": secret(source.privateKeySecret),
							...APP_TOKEN_PERMISSIONS,
						},
					},
				],
				token: `\${{ steps.${APP_TOKEN_STEP}.outputs.token || github.token }}`,
			};

/**
 * A run clones the repo again into a temp folder, so the git identity and credentials are global: the checkout's own
 * are local to its workspace. Global here is the job's own file, which `JOB_PATHS_STEP` names, so no other job on the
 * machine commits as hum. The credential helper hands git the token in the env when git asks, so git needs no `gh`,
 * which a job container may lack. In a job container the runner's user may own the checkout while the steps run as
 * root, and git refuses a repo another user owns until it is trusted.
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
 * Claude Code install through npm into the job's temp folder, so the job needs only git, node and npm from its runner
 * or container, and leaves nothing on a machine that outlives it. The Claude sign-in, the GitHub token and every
 * `ciEnv` value that reads a secret reach the last step alone. An App's token lasts an hour, so it is minted last.
 */
const wake = ({ commitIdentity, ciWakeTimeoutMinutes, pullRequestToken, ciRunner, ciContainer, ciEnv, ciClaudeAuth }: WorkflowSettings) => {
	const claude = CLAUDE_SIGN_IN[ciClaudeAuth];
	const github = githubToken(pullRequestToken);
	const env = envByReach(ciEnv);

	return {
		name: "hum wake",
		on: { workflow_call: { secrets: { ...ownerSecrets({ ciRunner, ciContainer, ciEnv }), ...claude.secrets, ...github.secrets } } },
		permissions: PERMISSIONS,
		jobs: {
			wake: {
				"runs-on": ciRunner,
				container: ciContainer ?? NO_KEY,
				"timeout-minutes": ciWakeTimeoutMinutes,
				env: { ...env.everyStep, ...github.env, [ENV.event]: "${{ github.event_name }}" },
				steps: [
					{ uses: ACTIONS.checkout.uses, with: { "fetch-depth": 0 } },
					JOB_PATHS_STEP,
					{ run: `npm install --global --prefix "${JOB_TOOLS}" bun@${BUN_VERSION} @anthropic-ai/claude-code@${CLAUDE_FLOOR}` },
					{ run: "bun install --frozen-lockfile" },
					{ run: `claude plugin marketplace add ${HOPE_MARKETPLACE}\nclaude plugin install hope@moo.md\n` },
					gitSetup(commitIdentity),
					...github.steps,
					{ run: `./node_modules/.bin/hum wake --event "$${ENV.event}"`, env: { ...env.humStep, ...claude.env, [ENV.githubToken]: github.token } },
				],
			},
		},
	};
};

/** A comment wakes hum only when a person the repo trusts wrote it: on a public repo anyone may comment, and a wake holds every secret. */
const TRUSTED_COMMENT = `github.event.comment.user.type != 'Bot' && contains(fromJSON('${JSON.stringify(TRUSTED_ASSOCIATIONS)}'), github.event.comment.author_association)`;

type Workflow = ReturnType<typeof wake> | ReturnType<typeof trigger>;

/** A workflow as YAML, each pinned action followed by its release as a comment, and a value two keys share written out under both. */
const render = (workflow: Workflow): string => {
	const document = new Document(workflow, { aliasDuplicateObjects: false });

	visit(document, {
		Scalar: (_key, node) => {
			const release = RELEASE_OF.get(String(node.value));

			if (release !== undefined) node.comment = ` ${release}`;
		},
	});

	return document.toString({ lineWidth: 0 });
};

const WORKFLOWS = {
	[WORKFLOW_FILES.wake]: wake,
	[WORKFLOW_FILES.comment]: () => trigger("hum on comment", { issue_comment: { types: ["created"] } }, { if: TRUSTED_COMMENT }),
	[WORKFLOW_FILES.push]: ({ itemsDir, runBranchPrefix }) => trigger("hum on item push", { push: { branches: ["**", `!${runBranchPrefix}**`], paths: [`${itemsDir}/**`] } }),
	[WORKFLOW_FILES.dispatch]: () => trigger("hum on dispatch", { repository_dispatch: { types: [DISPATCH_EVENT] } }),
	[WORKFLOW_FILES.schedule]: ({ ciSchedule }) => trigger("hum on schedule", { schedule: [{ cron: ciSchedule }], workflow_dispatch: null }),
} as const satisfies Record<(typeof WORKFLOW_FILES)[keyof typeof WORKFLOW_FILES], (settings: WorkflowSettings) => object>;

export type WorkflowFile = { readonly file: string; readonly text: string };

/** The workflow files for an owner's repo, each named for `.github/workflows/`. */
export const ciWorkflows = (settings: WorkflowSettings): WorkflowFile[] =>
	Object.entries(WORKFLOWS).map(([file, build]) => ({ file, text: render(build(settings)) }));
