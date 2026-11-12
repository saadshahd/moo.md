import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { x } from "tinyexec";
import { sh } from "./fixtures/work-repo.ts";
import { slotWorld, type SlotSettings, type SlotWorld } from "./fixtures/slot-world.ts";

const dockerUp = await x("docker", ["info"]).then(
	({ exitCode }) => exitCode === 0,
	() => false,
);

if (!dockerUp) console.log("skip run-slot service tests: docker is not running");

const PREFIX = "humslot";
const SHARED_SERVER = "humslot-shared-pg";
const PORTS = { base: 38600, stride: 10 };
const SERVER_WAIT_MS = 500;
const SERVER_TRIES = 60;

const docker = (args: string[], env: Record<string, string> = {}) => x("docker", args, { nodePath: false, nodeOptions: { env: { ...process.env, ...env } } });

const worlds: SlotWorld[] = [];

const world = (settings: SlotSettings): SlotWorld => {
	const made = slotWorld({ projectPrefix: PREFIX, ports: PORTS, ...settings });

	worlds.push(made);

	return made;
};

afterEach(async () => {
	for (const made of worlds.splice(0)) {
		await made.slots.idle();
		made.dispose();
	}
});

const composeProjects = async (): Promise<string[]> => {
	const { stdout } = await docker(["ps", "--filter", `label=com.docker.compose.project`, "--format", '{{.Label "com.docker.compose.project"}}']);

	return [...new Set(stdout.split("\n").filter((name) => name.startsWith(PREFIX)))].sort();
};

const COMPOSE = "services:\n  cache:\n    image: redis:7-alpine\n    ports:\n      - '127.0.0.1:${HUM_SLOT_PORT_BASE}:6379'\n";

test.skipIf(!dockerUp)("two slots prepared from one compose file run at once under two project names, on two ports", async () => {
	const w = world({
		runners: 2,
		seed: (repo) => {
			writeFileSync(join(repo.owner, "compose.yaml"), COMPOSE);
			sh(repo.owner, ["add", "compose.yaml"]);
			repo.commit("compose");
			sh(repo.owner, ["push", "-q", "origin", "main"]);
		},
		recipe: { prepare: ["docker compose up -d --wait"], ready: ["docker compose exec -T cache redis-cli ping"] },
	});

	try {
		const [first, second] = await Promise.all([w.ask("a"), w.ask("b")]);
		const ports = await Promise.all([first, second].map(async ({ env }) => (await docker(["compose", "port", "cache", "6379"], env)).stdout.trim()));

		expect(await composeProjects()).toEqual([`${PREFIX}-slot-1`, `${PREFIX}-slot-2`]);
		expect(ports.sort()).toEqual([`127.0.0.1:${PORTS.base}`, `127.0.0.1:${PORTS.base + PORTS.stride}`]);
	} finally {
		for (const name of [`${PREFIX}-slot-1`, `${PREFIX}-slot-2`]) await docker(["compose", "-p", name, "down", "-v", "--remove-orphans"], { COMPOSE_PROJECT_NAME: name });
	}
}, 120_000);

const psql = (database: string, ...commands: string[]) => docker(["exec", SHARED_SERVER, "psql", "-U", "postgres", "-d", database, "-tA", ...commands.flatMap((command) => ["-c", command])]);

beforeAll(async () => {
	if (!dockerUp) return;

	await docker(["rm", "-f", SHARED_SERVER]);
	await docker(["run", "-d", "--name", SHARED_SERVER, "-e", "POSTGRES_PASSWORD=hum", "postgres:16-alpine"]);

	for (let tries = 0; tries < SERVER_TRIES; tries++) {
		if ((await docker(["exec", SHARED_SERVER, "pg_isready", "-U", "postgres"])).exitCode === 0 && (await psql("postgres", "select 1")).exitCode === 0) return;

		await Bun.sleep(SERVER_WAIT_MS);
	}

	throw new Error("the shared postgres server did not start");
}, 120_000);

afterAll(async () => {
	if (dockerUp) await docker(["rm", "-f", "-v", SHARED_SERVER]);
});


test.skipIf(!dockerUp)("on one shared set of services each slot gets its own database, and refreshing one slot leaves the other's row", async () => {
	const inServer = (command: string) => `docker exec ${SHARED_SERVER} psql -U postgres -d postgres -c "${command}"`;

	const w = world({
		runners: 2,
		services: "shared",
		recipe: {
			prepare: [inServer("CREATE DATABASE $HUM_SLOT_DATABASE")],
			refresh: [{ run: `${inServer("DROP DATABASE IF EXISTS $HUM_SLOT_DATABASE")} && ${inServer("CREATE DATABASE $HUM_SLOT_DATABASE")}`, when: "always" }],
			ready: [`docker exec ${SHARED_SERVER} psql -U postgres -d $HUM_SLOT_DATABASE -c "select 1"`],
		},
	});

	const [first, second] = await Promise.all([w.ask("a"), w.ask("b")]);

	await Promise.all(
		[first, second].map(({ env }) =>
			x("sh", ["-c", `docker exec ${SHARED_SERVER} psql -U postgres -d "$HUM_SLOT_DATABASE" -c "create table marker(v text)" -c "insert into marker values ('$HUM_SLOT')"`], { nodePath: false, nodeOptions: { env: { ...process.env, ...env } } }),
		),
	);

	const rowsOf = async (taken: typeof first) => (await psql(taken.env.HUM_SLOT_DATABASE ?? "", "select v from marker")).stdout.trim();

	expect(first.env.HUM_SLOT_DATABASE).not.toBe(second.env.HUM_SLOT_DATABASE);
	expect(await rowsOf(first)).toBe("slot-1");
	expect(await rowsOf(second)).toBe("slot-2");
	expect(Object.values(first.env).join(" ")).not.toContain("slot-2");

	await first.giveBack();
	await w.slots.idle();

	expect((await psql(first.env.HUM_SLOT_DATABASE ?? "", "select v from marker")).exitCode).not.toBe(0);
	expect(await rowsOf(second)).toBe("slot-2");
}, 120_000);
