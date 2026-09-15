// NOTE: o matcher abaixo libera .mjs do gate de autenticação — é o worker
// estático do pdfjs (lib pública, sem dados sensíveis) usado na importação de PDF.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Deny-by-default: only these paths (and the OAuth callback) are reachable
  // without a session. Every other route — including any added later — is
  // protected automatically instead of requiring an ever-growing allowlist.
  const publicPaths = new Set([
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ])
  const isPublicPath =
    publicPaths.has(pathname) || pathname.startsWith('/auth/callback')

  let session = null
  if (pathname !== '/') {
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession()
      session = authSession
    } catch {
      // Session not available or expired
    }
  }

  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs)$).*)',
  ],
}
