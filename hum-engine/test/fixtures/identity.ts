import type { GitIdentity } from "../../src/adapters/git.ts";

/** The owner in tests. example.com is a domain no account can claim, so no commit made here is credited to anyone. */
export const OWNER: GitIdentity = { name: "Owner", email: "owner@example.com" };
