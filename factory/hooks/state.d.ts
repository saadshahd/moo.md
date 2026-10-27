import type { Bot } from "../lib/bot.ts";

export type FactoryRun = { repo: string; issue: number; cwd: string };

declare module "claude-code" {
  interface PluginState {
    factory: {
      /** The run this session is, or null when it is no factory run; resolved once a session. */
      run: FactoryRun | null;
      /** Held in the session's memory only: a bot token never lands on disk. */
      bot: Bot;
      /** The run was told it has no GitHub login. */
      hinted: boolean;
      notesAt: number;
      shown: string[];
    };
  }
}
