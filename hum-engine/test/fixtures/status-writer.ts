// Child process for the U1 test: rewrites the status file many times with growing content.
import { emptyStatus, writeStatus } from "../../src/index.ts";

const [path, count] = process.argv.slice(2);

if (!path || !count) throw new Error("usage: status-writer.ts <status path> <count>");

for (let at = 1; at <= Number(count); at++) {
	const status = emptyStatus("0.1.0", at);

	status.questions = Array.from({ length: at % 400 }, (_, index) => ({ item: `#${index}`, text: `question ${index} `.repeat(20), since: at }));
	writeStatus(path, status);
}
