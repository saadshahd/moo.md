/** The package manager each lockfile says. */
export const LOCKFILES = {
	"bun.lock": "bun",
	"bun.lockb": "bun",
	"pnpm-lock.yaml": "pnpm",
	"yarn.lock": "yarn",
	"package-lock.json": "npm",
	"uv.lock": "uv",
	"poetry.lock": "poetry",
	"Cargo.lock": "cargo",
	"go.sum": "go",
} as const satisfies Record<string, string>;

export type PackageManager = (typeof LOCKFILES)[keyof typeof LOCKFILES];

/** The command that installs from the lockfile alone, per package manager. */
export const INSTALL_COMMANDS = {
	bun: "bun install --frozen-lockfile",
	pnpm: "pnpm install --frozen-lockfile",
	yarn: "yarn install --immutable",
	npm: "npm ci",
	uv: "uv sync --frozen",
	poetry: "poetry install --sync",
	cargo: "cargo fetch --locked",
	go: "go mod download",
} as const satisfies Record<PackageManager, string>;

/** The command that runs a package script, per package manager that has scripts. */
export const RUN_SCRIPT: Readonly<Record<PackageManager, string | undefined>> = { bun: "bun run", pnpm: "pnpm run", yarn: "yarn", npm: "npm run", uv: undefined, poetry: undefined, cargo: undefined, go: undefined };

/** Package scripts that check a change, in the order a repo's own run gives them. */
export const CHECK_SCRIPTS = ["check", "typecheck", "lint", "test"] as const;

/** Package scripts, justfile and Makefile targets that set up or seed an environment. */
export const SETUP_TARGETS = ["setup", "bootstrap", "seed", "dev:setup", "db:seed", "db:setup"] as const;

/** A CI command line that checks the change. */
export const CHECK_COMMAND = /\b(test|tests|lint|typecheck|type-check|tsc|check|vitest|jest|pytest|clippy|eslint|oxlint|biome|ruff|mypy|vet)\b/;

/** A CI command line that is not a check, whatever words it holds: installs, publishing, shell plumbing. */
export const NOT_A_CHECK = /^(echo|export|cd|mkdir|cp|mv|rm|curl|wget|sudo|gh|git)\b|\b(install|publish|deploy|release|upload|setup)\b/;

/** The files that hold a repo's tool versions. */
export const TOOL_VERSION_FILES = [".tool-versions", ".nvmrc", ".node-version", ".bun-version", ".python-version", "mise.toml", ".mise.toml", "rust-toolchain.toml", ".go-version"] as const;

/** Where owners keep a script that sets up a working environment, in the order a repo's own convention is preferred. */
export const ENV_SCRIPTS = ["bin/setup", "script/setup", "scripts/setup", "scripts/setup.sh", "bin/env", "scripts/env", "scripts/env.sh"] as const;

export const ENV_EXAMPLE_FILES = [".env.example", ".env.sample", ".env.template"] as const;

/** The owner's own environment tooling: a recipe calls it and rebuilds nothing. */
export const ENV_TOOLING_FILES = [".envrc", "mise.toml", ".mise.toml", "devbox.json", "flake.nix", ".devcontainer/devcontainer.json", "Tiltfile"] as const;

export const COMPOSE_FILES = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"] as const;

export const CODEOWNERS_FILES = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"] as const;

export const WORKFLOW_FOLDER = ".github/workflows";

export const ISSUE_TEMPLATE_FOLDER = ".github/ISSUE_TEMPLATE";

/** Paths that hold data or secrets, as globs; setup proposes the ones a repo's tracked files match. */
export const DATA_AND_SECRET_GLOBS = [
	"**/migrations/**",
	"**/*.sql",
	"**/.env",
	"**/.env.*",
	"**/*.pem",
	"**/*.key",
	"**/secrets/**",
	"**/credentials*",
	"**/*.tfstate",
	"**/schema.prisma",
] as const;

/** A file that shows the shape of a secret without holding one. */
export const SECRET_TEMPLATE = /\.(example|sample|template)$/;

/** How careful a top-level folder is, as a position among the risk levels: 0 is the lowest. */
export const FOLDER_RANKS = [
	{ rank: 0, folder: /^(docs?|documentation|examples?|samples?)$/ },
	{ rank: 2, folder: /^(infra|infrastructure|deploy|deployment|terraform|k8s|helm|ops|\.github|\.circleci)$/ },
] as const;

export const DEFAULT_FOLDER_RANK = 1;

/** The risk level position of a root-level markdown file, and of any other root file. */
export const ROOT_MARKDOWN_RANK = 0;

/** The words a repo's labels use for a kind of work, per kind name. A label the table lacks goes to the kind question. */
export const KIND_LABEL_WORDS = {
	fix: ["bug", "bugfix", "defect", "regression", "fix", "type: bug", "kind/bug"],
	feature: ["feature", "enhancement", "feat", "improvement", "type: feature", "kind/feature"],
	docs: ["docs", "documentation", "doc", "type: docs", "kind/documentation"],
	hotfix: ["hotfix", "urgent", "incident", "p0", "critical"],
} as const satisfies Record<string, readonly string[]>;

/** Hours a wait gets before it ends stuck, by who it waits on. */
export const WAIT_HOURS = { owner: 72, other: 24 } as const;

/** Tracked files setup reads the repo's shape from, at most. */
export const TRACKED_FILE_LIMIT = 50_000;
