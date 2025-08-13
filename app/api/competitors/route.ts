import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { type CookieOptions, createServerClient } from '@supabase/ssr'

function serverClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(n: string) {
          return cookieStore.get(n)?.value
        },
        set(n: string, v: string, o: CookieOptions) {
          cookieStore.set({ name: n, value: v, ...o })
        },
        remove(n: string, o: CookieOptions) {
          cookieStore.set({ name: n, value: '', ...o })
        },
      },
    },
  )
}

export async function GET(req: Request) {
  const supabase = serverClient()
  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('search_id')
  if (!searchId) return NextResponse.json({ error: 'missing search_id' }, { status: 400 })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('search_id', searchId)
    .order('rating', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ competitors: data ?? [] })
}
