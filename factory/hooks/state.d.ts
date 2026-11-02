export type FactoryRun = { repo: string; issue: number; cwd: string };

declare module "claude-code" {
  interface PluginState {
    factory: {
      /** The run this session is, or null when it is no factory run; resolved once a session. */
      run: FactoryRun | null;
      /** Held in the session's memory only: a bot token never lands on disk. */
      bot: { token: string; expiresAt: string; name: string; email: string };
      /** The session's own values of what `useLogin` sets, read before it first set one; unset ones undefined. */
      ownLogin: Record<
        "GH_CONFIG_DIR" | "GH_TOKEN" | "GITHUB_TOKEN" | "GIT_AUTHOR_NAME" | "GIT_AUTHOR_EMAIL" | "GIT_COMMITTER_NAME" | "GIT_COMMITTER_EMAIL",
        string | undefined
      >;
      /** The run was told it has no GitHub login. */
      hinted: boolean;
      notesAt: number;
      shown: string[];
    };
  }
}
