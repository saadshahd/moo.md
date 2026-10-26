import type { Register } from "claude-code";
import { register as registerRun } from "../hooks/run.ts";
import { registerPane } from "./pane.tsx";

// The plugin's one hooks module: the run hooks every factory run works under, and /factory.
export const register: Register = (on, options) => {
  registerRun(on, options);
  registerPane(on, options);
};
