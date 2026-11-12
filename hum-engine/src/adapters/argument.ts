import { z } from "zod";
import { PermanentError } from "../adapter-api.ts";

/** A caller's argument, parsed. One that fails is the caller's mistake, which no retry fixes. */
export const parseArgument = <S extends z.ZodType>(schema: S, value: z.input<S>): z.output<S> => {
	const parsed = schema.safeParse(value);

	if (!parsed.success) throw new PermanentError(z.prettifyError(parsed.error));

	return parsed.data;
};
