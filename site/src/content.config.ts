import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // A move page: what the move does, in five words or fewer, beside its command.
        move: z.string().refine((s) => s.split(/\s+/).length <= 5, "five words or fewer").optional(),
        // A chain page: its moves in order, as its demo runs them.
        moves: z.array(z.string()).optional(),
      }),
    }),
  }),
};
