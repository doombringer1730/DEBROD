import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, isValidSession, sitePassword } from './lib/auth'

export function proxy(request: NextRequest) {
  if (!sitePassword()) {
    return new NextResponse('Set SITE_PASSWORD to use this site.', { status: 503 })
  }
  if (request.nextUrl.pathname === '/login') return NextResponse.next()
  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next()
  // Remember where they were going (an invite link, say) for after sign-in.
  const login = new URL('/login', request.url)
  const { pathname, search } = request.nextUrl
  if (pathname !== '/') login.searchParams.set('next', pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
