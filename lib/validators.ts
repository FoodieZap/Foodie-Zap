// lib/validators.ts
import { z } from 'zod'

export const NewSearchSchema = z.object({
  query: z.string().min(1),
  city: z.string().min(1),

  // existing (if you already had these, keep them)
  radiusMeters: z.number().optional(),
  limit: z.number().optional(),

  // ✅ NEW filters
  minRating: z.number().min(0).max(5).optional(),
  maxDistanceMeters: z.number().min(1).optional(),
})

// (optional) export the inferred type if you use it elsewhere
export type NewSearchInput = z.infer<typeof NewSearchSchema>
