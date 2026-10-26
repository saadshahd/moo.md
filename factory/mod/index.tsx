import type { Register } from "claude-code";
import { register as registerRun } from "../hooks/run.ts";
import { registerPane } from "./pane.tsx";

export const register: Register = (on, options) => {
  registerRun(on, options);
  registerPane(on, options);
};
