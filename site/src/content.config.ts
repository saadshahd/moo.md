import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // A move page: what the move does, in eight words or fewer, beside its command.
        move: z.string().refine((s) => s.split(/\s+/).length <= 8, "eight words or fewer").optional(),
        // A chain page: its moves in order, as its demo runs them.
        moves: z.array(z.string()).optional(),
        // A part page with a top band: the motion piece beside its title
        // (PageTitle.astro).
        band: z.enum(["pace", "pile"]).optional(),
      }),
    }),
  }),
};
