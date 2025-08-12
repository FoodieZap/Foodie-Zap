'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY automatically
export const supabase = createClientComponentClient()
