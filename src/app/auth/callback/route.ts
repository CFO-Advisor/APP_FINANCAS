import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'

// Only same-origin, single-leading-slash paths are allowed. Blocks the
// classic "@evil.com" and "//evil.com" open-redirect tricks that a raw
// `${origin}${next}` concatenation is vulnerable to.
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('@') || next.includes('\\')) {
    return '/dashboard'
  }
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'))

  const supabase = await createClient()

  // Fluxo token_hash (e-mail de reset/confirmação sem PKCE)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Fluxo PKCE (code exchange)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_invalido`)
}
