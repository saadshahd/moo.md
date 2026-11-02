export type FactoryRun = { repo: string; issue: number; cwd: string };

declare module "claude-code" {
  interface PluginState {
    factory: {
      /** The run this session is, or null when it is no factory run; resolved once a session. */
      run: FactoryRun | null;
      notesAt: number;
      shown: string[];
    };
  }
}
