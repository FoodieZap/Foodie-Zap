import { z } from 'zod';

export const searchInput = z.object({
  query: z.string().min(2),
  city: z.string().min(2)
});

export type SearchInput = z.infer<typeof searchInput>;

