export type FactoryRun = { repo: string; issue: number; cwd: string };

export type FactoryBot = {
  token: string;
  expiresAt: string;
  name: string;
  email: string;
};

declare module "claude-code" {
  interface PluginState {
    factory: {
      /** The run this session is, or null when it is no factory run; resolved once a session. */
      run: FactoryRun | null;
      /** Held in the session's memory only: a bot token never lands on disk. */
      bot: FactoryBot;
      notesAt: number;
      shown: string[];
    };
  }
}
