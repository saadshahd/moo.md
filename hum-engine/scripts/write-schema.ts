import { z } from "zod";
import { HumConfig } from "../src/config/schema.ts";

await Bun.write(
	new URL("../schema/hum.schema.json", import.meta.url),
	`${JSON.stringify(z.toJSONSchema(HumConfig, { io: "input" }), null, "\t")}\n`,
);
