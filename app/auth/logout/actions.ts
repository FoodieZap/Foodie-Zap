'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase' // adjust import if your helper is elsewhere

export async function logout() {
  const supabase = await createSupabaseServer()

  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }

  // After logging out, send back to login page
  redirect('/auth/login')
}
