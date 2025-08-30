// utils/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // NOTE: NOT public
  if (!url || !serviceKey) {
    throw new Error(
      'Supabase admin not configured: check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  })
}
