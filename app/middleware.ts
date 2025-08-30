// app/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  // Never run middleware on Next internals or static files
  matcher: ['/((?!_next|api|fonts|images|favicon|robots\\.txt|sitemap\\.xml).*)'],
}
