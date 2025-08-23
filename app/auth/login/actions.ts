'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase' // your server ACTION helper

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    // you can throw an error and catch it on the page if you render errors
    throw new Error('Email and password are required')
  }

  const supabase = await createSupabaseServer()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // Option A: rethrow to show an error message on the page
    throw new Error(error.message)
  }

  // Success: send them to dashboard or home
  redirect('/dashboard')
}
