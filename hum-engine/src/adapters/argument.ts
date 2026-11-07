import { z } from "zod";
import { PermanentError } from "../adapter-api.ts";

/** A caller's argument, parsed. One that fails is the caller's mistake, which no retry fixes. */
export const parseArgument = <Out, In>(schema: z.ZodType<Out, In>, value: In): Out => {
	const parsed = schema.safeParse(value);

	if (!parsed.success) throw new PermanentError(z.prettifyError(parsed.error));

	return parsed.data;
};
