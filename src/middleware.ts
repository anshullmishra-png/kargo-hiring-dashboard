import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, safeEqual, tokenFor } from '@/lib/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next()

  const password = process.env.DASHBOARD_PASSWORD
  if (!password) {
    // Fail closed in production: this app holds candidate personal data.
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('DASHBOARD_PASSWORD is not set. Set it in the environment and redeploy.', { status: 503 })
    }
    return NextResponse.next()
  }

  const cookie = req.cookies.get(COOKIE)?.value ?? ''
  if (cookie && safeEqual(cookie, await tokenFor(password))) return NextResponse.next()

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
