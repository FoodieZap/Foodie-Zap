'use server'

import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const cookieStore = await cookies() // ✅ Next 15 requires await

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // In Server Actions, cookies() is mutable. TS thinks it's readonly, so cast to any.
          ;(cookieStore as any).set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          ;(cookieStore as any).set({ name, value: '', ...options })
        },
      },
    },
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // return an error shape your UI expects
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
