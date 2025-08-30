import { z } from 'zod'

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  // server-only
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  YELP_API_KEY: z.string().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),

  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  MOCK_MODE: z.enum(['true', 'false']).default('false'),
  SEARCH_LIMIT_BYPASS: z.enum(['true', 'false']).default('false'),
  SEARCH_RADIUS_KM: z.string().default('10'),
})

// Export a parsed, type-safe ENV object
export const ENV = EnvSchema.parse(process.env)
