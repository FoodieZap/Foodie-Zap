// utils/supabase/route.ts
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**

// * Next.js 15: cookies() is async and returns a *readonly* object.
// * We only *read* cookies here; set/remove are no-ops for typical API reads.
// */
export async function createSupabaseRoute() {
  const cookieStore = await cookies() // ✅ Next 15 requires await

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        // In route handlers, cookieStore is readonly. For most endpoints
        // we don't need to mutate cookies. Keep these as no-ops.
        set(_name: string, _value: string, _options: CookieOptions) {
          /* no-op */
        },
        remove(_name: string, _options: CookieOptions) {
          /* no-op */
        },
      },
    },
  )
}
