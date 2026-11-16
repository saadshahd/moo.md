import type { Register } from "claude-code";
import { register as tend } from "./tend.tsx";
import { register as unsaid } from "./unsaid.tsx";

export const register: Register = (on, options) => {
  tend(on, options);
  unsaid(on, options);
};
