/**
 * Zod here, but this could be Drizzle tables or Kysely names: the engine never
 * looks at a target, only the adapter and the wrapper in setup.ts do.
 */
import { z } from "zod";

export const publisherSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Set by a link once books exist, since books point back at publishers. */
  flagshipBookId: z.string().nullable().optional(),
});

export const authorSchema = z.object({
  id: z.string(),
  publisherId: z.string(),
  name: z.string(),
  email: z.email(),
});

export const bookSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  publisherId: z.string(),
  title: z.string().min(1),
  publishedAt: z.date(),
  pages: z.number().int().min(1),
});
