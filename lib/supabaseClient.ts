// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const hasEnv =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.length > 0 &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 0

// Create a client even if envs are missing; we’ll report that in /api/health
export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseAnonKey || 'anon')
