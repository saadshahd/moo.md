import type { HumConfig } from "./schema.ts";

/** The secret Claude Code's OAuth token is stored in, under the env name Claude Code reads it from. */
export const CLAUDE_TOKEN = "CLAUDE_CODE_OAUTH_TOKEN";

/** The env the wake's jobs set themselves. */
export const WAKE_ENV = {
	claudeToken: CLAUDE_TOKEN,
	githubToken: "GH_TOKEN",
	event: "HUM_EVENT",
	/** Whether both of the App's secrets are set, because a step's `if` cannot read a secret. */
	hasApp: "HUM_HAS_APP",
	gitName: "HUM_GIT_NAME",
	gitEmail: "HUM_GIT_EMAIL",
	/** Set from env, so no shell expands the token's name before git runs the helper. */
	gitCredentialHelper: "HUM_GIT_CREDENTIAL_HELPER",
	/** Git's own name for the file `git config --global` writes: the job points it into the runner's temp folder. */
	gitConfig: "GIT_CONFIG_GLOBAL",
	/** What gather settled, from its job outputs, for the publish job. */
	gathered: "HUM_GATHERED",
} as const;

/** The env names the wake job sets itself, which `ciEnv` may not set. */
export const WAKE_OWN_ENV: ReadonlySet<string> = new Set(Object.values(WAKE_ENV));

/** The action that mints a GitHub App's token, named without its version. */
export const APP_TOKEN_ACTION = "actions/create-github-app-token";

/** GitHub's fixed life of an App's installation token. */
export const APP_TOKEN_MINUTES = 60;

/** The workflow files hum writes: the wake job, and one trigger per event that starts it. */
export const WORKFLOW_FILES = {
	wake: "hum-wake.yml",
	comment: "hum-comment.yml",
	push: "hum-push.yml",
	dispatch: "hum-dispatch.yml",
	schedule: "hum-schedule.yml",
} as const;

/** The names of the workflow files hum writes. */
export const CI_WORKFLOW_FILES: ReadonlySet<string> = new Set(Object.values(WORKFLOW_FILES));

/**
 * How GitHub relates a comment's author to the repo, for the people hum hears: the owner, a member of the owning
 * organisation and an invited collaborator. Anyone else's comment starts no wake and is no reply.
 */
export const TRUSTED_ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR"] as const;

/** What the wake job takes from the owner as written, where a workflow expression may sit: the runner, the container and env. */
export type WakeJobSetting = HumConfig["ciRunner"] | HumConfig["ciContainer"] | HumConfig["ciEnv"];

/** `secrets.NAME` or `secrets['NAME']`; the quote may follow a backslash, as it does in a setting's JSON. */
const NAMED_SECRET = /\bsecrets\s*(?:\.\s*|\[\s*\\?['"])([A-Za-z_][A-Za-z0-9_]*)/g;

/** The secrets the workflow expressions in the settings name. */
export const secretsNamed = (...settings: readonly WakeJobSetting[]): string[] => [...JSON.stringify(settings).matchAll(NAMED_SECRET)].flatMap(([, name]) => name ?? []);

/** Whether `text` reads the secrets context at all, named or whole. */
export const readsSecrets = (text: string): boolean => /\bsecrets\b/.test(text);

/** A workflow expression that reads a context the wake job lacks: it has no matrix, no earlier job, and takes no inputs. */
const FOREIGN_CONTEXT = /\$\{\{[^}]*\b(matrix|strategy|needs|steps|inputs)\s*[.[]/;

/** Whether a setting holds an expression that means nothing in the wake job, so a value copied from another job would break it. */
export const readsForeignContext = (setting: WakeJobSetting): boolean => FOREIGN_CONTEXT.test(JSON.stringify(setting));

type Runner = HumConfig["ciRunner"];

const isGroup = (runner: Runner): runner is Extract<Runner, { readonly group: string }> => runner instanceof Object && "group" in runner;

/** The labels of the runners GitHub hosts start with the system they run. */
const HOSTED_LABEL = /^(ubuntu|windows|macos)-/;

/** Whether GitHub hosts the runner: a fresh machine per job. A group, or any other label, may be a machine that outlives the job. */
export const isGitHubHosted = (runner: Runner): boolean => !isGroup(runner) && [runner].flat().every((label) => HOSTED_LABEL.test(label));
