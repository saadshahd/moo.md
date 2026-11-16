// hunch's contract: the session state unsaid keeps. Held by the host for the session only. Callers
// spell the ref as a literal in their own file: { plugin: "hunch", key: "unsaid" }.

/** The work orders checked this session, each by its labelled lines as written, oldest first. */
export type Unsaid = { checked: string[] };

declare module "claude-code" {
  interface PluginState {
    hunch: { unsaid: Unsaid };
  }
}
