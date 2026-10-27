/**
 * The factory's GitHub App: runs act on GitHub as its bot, never as the user, so GitHub can tell
 * a run's comment from the user's. Each user creates their own App; `/factory:setup` walks it.
 * `~/.config/factory/app.json` names it: `{ "clientId": "Iv23…", "key": "app.pem" }`, the key
 * path relative to that folder.
 */

import { createAppAuth } from "@octokit/auth-app";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Bot } from "../lib/bot.ts";
import * as z from "../lib/vendor/zod-mini.js";

const DIR = join(homedir(), ".config", "factory");
const API = "https://api.github.com";

const AppFile = z.object({ clientId: z.string(), key: z.string() });

export type App = ReturnType<typeof createAppAuth>;

export async function readApp(): Promise<App> {
  const file = Bun.file(join(DIR, "app.json"));

  if (!(await file.exists()))
    throw new Error(`no ${join(DIR, "app.json")}; run /factory:setup to create the factory's GitHub App`);
  const { clientId, key } = z.parse(AppFile, await file.json());
  const pem = Bun.file(join(DIR, key));

  if (!(await pem.exists())) throw new Error(`the App's private key ${join(DIR, key)} is missing`);

  return createAppAuth({ appId: clientId, privateKey: await pem.text() });
}

async function get<T>(path: string, bearer: string, schema: z.ZodMiniType<T>): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!r.ok) throw new Error(`GitHub GET ${path}: ${r.status} ${await r.text()}`);

  return z.parse(schema, await r.json());
}

/** A fresh installation token for `repo`, and the bot it acts as. */
export async function botFor(app: App, repo: string): Promise<Bot> {
  const { token: jwt } = await app({ type: "app" });
  const { slug } = await get("/app", jwt, z.object({ slug: z.string() }));

  const Id = z.object({ id: z.int() });
  const { id } = await get(`/repos/${repo}/installation`, jwt, Id);
  const { token, expiresAt } = await app({ type: "installation", installationId: id });
  const name = `${slug}[bot]`;
  const user = await get(`/users/${encodeURIComponent(name)}`, token, Id);

  return { token, expiresAt, name, email: `${user.id}+${name}@users.noreply.github.com` };
}
