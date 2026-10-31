import type { Register } from "claude-code";
import { register as reach } from "./reach.ts";
import { register as slop } from "./slop.tsx";

export const register: Register = (on, options) => {
  reach(on, options);
  slop(on, options);
};
