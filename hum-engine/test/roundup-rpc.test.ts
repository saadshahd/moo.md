import { expect, test } from "bun:test";
import { createServer } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { roundupRpc } from "../src/adapters/roundup-rpc.ts";
import { tempDir } from "./fixtures/temp.ts";

test("a closed roundup client fails every later call and opens no connection again", async () => {
	const socket = join(tempDir("rpc"), "rupd.sock");
	let connections = 0;

	const daemon = createServer((conn) => {
		connections++;
		createInterface({ input: conn }).on("line", (line) => {
			const { id } = JSON.parse(line);

			conn.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { answered: true } })}\n`);
		});
	});

	await new Promise<void>((resolve) => daemon.listen(socket, resolve));

	const client = roundupRpc(socket, null);

	try {
		expect(await client.call("daemon.ping")).toEqual({ answered: true });

		client.close();

		await expect(client.call("daemon.ping")).rejects.toThrow("is closed");
		await expect(client.open()).rejects.toThrow("is closed");
		expect(connections).toBe(1);
	} finally {
		daemon.close();
	}
});
