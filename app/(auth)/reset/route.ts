// app/auth/reset/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const jar = cookies()
  // purge all Supabase auth cookies (names start with "sb-")
  for (const c of (await jar).getAll()) {
    if (c.name.startsWith('sb-')) {
      ;(await jar).set(c.name, '', { path: '/', expires: new Date(0) })
    }
  }
  // optional: also nuke legacy cookies your app might set
  ;(
    await // optional: also nuke legacy cookies your app might set
    jar
  ).set('supabase-auth-token', '', { path: '/', expires: new Date(0) })

  // redirect to login
  return NextResponse.redirect(
    new URL('/auth/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  )
}
