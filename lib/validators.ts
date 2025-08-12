import { z } from 'zod'

export const NewSearchSchema = z.object({
  query: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
})

export type NewSearchInput = z.infer<typeof NewSearchSchema>
