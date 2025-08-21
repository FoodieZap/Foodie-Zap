'use server'

import { redirect } from 'next/navigation'
//import { createClientServer } from '../../lib/supabase'
import { createSupabaseServer } from '../../lib/supabase'
export async function signUp(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }
  redirect('/auth/dashboard')
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const supabase = await createSupabaseServer()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect('/auth/dashboard')
}

export async function signOut() {
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
