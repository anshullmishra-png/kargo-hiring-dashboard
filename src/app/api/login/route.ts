import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, safeEqual, tokenFor } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const expected = process.env.DASHBOARD_PASSWORD
  const { password } = await req.json().catch(() => ({ password: '' }))
  if (!expected || typeof password !== 'string' || !safeEqual(password, expected)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, await tokenFor(expected), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
