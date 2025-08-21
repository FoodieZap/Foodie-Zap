import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createSupabaseRSC() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {
          /* no-op in RSC */
        },
        remove() {
          /* no-op in RSC */
        },
      },
    },
  )
}
