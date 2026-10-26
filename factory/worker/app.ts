/**
 * The factory's GitHub App: runs act on GitHub as its bot, never as the user, so GitHub can tell
 * a run's comment from the user's. Each user creates their own App; `/factory:setup` walks it.
 * `~/.config/factory/app.json` names it: `{ "clientId": "Iv23…", "key": "app.pem" }`, the key
 * path relative to that folder.
 */

import { createSign } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Bot } from "../lib/github.ts";

const DIR = join(homedir(), ".config", "factory");
const API = "https://api.github.com";

export type App = { clientId: string; pem: string };


export async function readApp(): Promise<App> {
  const file = Bun.file(join(DIR, "app.json"));

  if (!(await file.exists()))
    throw new Error(
      `no ${join(DIR, "app.json")}; run /factory:setup to create the factory's GitHub App`,
    );

  /** SAFETY: setup writes this file with exactly these two string fields. */
  const { clientId, key } = (await file.json()) as {
    clientId: string;
    key: string;
  };

  const pem = Bun.file(join(DIR, key));

  if (!(await pem.exists()))
    throw new Error(`the App's private key ${join(DIR, key)} is missing`);

  return { clientId, pem: await pem.text() };
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function appJwt(app: App, nowS = Math.floor(Date.now() / 1000)): string {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));

  /** Issued a minute early, so a clock running slightly fast is still accepted. */
  const body = b64url(
    JSON.stringify({ iat: nowS - 60, exp: nowS + 540, iss: app.clientId }),
  );

  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(app.pem);

  return `${head}.${body}.${b64url(sig)}`;
}

async function github(
  path: string,
  bearer: string,
  method = "GET",
): Promise<Response> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!r.ok)
    throw new Error(`GitHub ${method} ${path}: ${r.status} ${await r.text()}`);

  return r;
}

export async function botFor(app: App, repo: string): Promise<Bot> {
  const jwt = appJwt(app);
  /** SAFETY: GitHub's app endpoint answers with the App's `slug`. */
  const { slug } = (await (await github("/app", jwt)).json()) as { slug: string };
  /** SAFETY: GitHub's installation endpoint answers with the installation's numeric `id`. */
  const { id } = (await (await github(`/repos/${repo}/installation`, jwt)).json()) as { id: number };
  const r = await github(`/app/installations/${id}/access_tokens`, jwt, "POST");
  /** SAFETY: GitHub's access-token endpoint answers with `token` and `expires_at`. */
  const { token, expires_at } = (await r.json()) as { token: string; expires_at: string };
  const name = `${slug}[bot]`;

  /** SAFETY: GitHub's user endpoint answers with the bot user's numeric `id`. */
  const user = (await (await github(`/users/${encodeURIComponent(name)}`, token)).json()) as {
    id: number;
  };

  return { token, expiresAt: expires_at, name, email: `${user.id}+${name}@users.noreply.github.com` };
}
