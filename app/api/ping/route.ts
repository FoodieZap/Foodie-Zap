// app/api/ping/route.ts
import { NextResponse } from 'next/server'

export const revalidate = 0 // always fresh

export async function GET() {
  return NextResponse.json({
    ok: true,
    pong: true,
    service: 'Foodie-Zap',
    time: new Date().toISOString(),
    version: '0.1.0',
  })
}
