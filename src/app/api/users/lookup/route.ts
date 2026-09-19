import { NextRequest, NextResponse } from 'next/server'

// POST /api/users/lookup
// Retorna e-mails de uma lista de user ids (para exibir nas telas de
// compartilhamento). Exige sessão válida; usa service role pois o cliente
// não pode consultar auth.users.
export async function POST(req: NextRequest) {
  try {
    const { ids } = (await req.json()) as { ids?: string[] }
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== 'string')) {
      return NextResponse.json({ error: 'Lista de ids inválida.' }, { status: 400 })
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Só permite lookup de ids ligados ao caller (dono ou convidado) — evita
    // enumeração de usuários arbitrários.
    const { data: related } = await supabase
      .from('shared_access')
      .select('owner_id, invitee_id')
      .or(`owner_id.eq.${user.id},invitee_id.eq.${user.id}`)
    const allowed = new Set<string>([user.id])
    for (const r of related ?? []) {
      allowed.add(r.owner_id)
      allowed.add(r.invitee_id)
    }
    const filtered = ids.filter((i) => allowed.has(i))
    if (filtered.length === 0) {
      return NextResponse.json({ emails: {} })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const { createServerClient } = await import('@supabase/ssr')
    const service = createServerClient(url, serviceKey, {
      cookies: { getAll: () => [], setAll: () => {} },
    })

    const { data: list, error: listErr } = await service.auth.admin.listUsers()
    if (listErr) {
      return NextResponse.json({ error: 'Falha ao consultar usuários.' }, { status: 500 })
    }

    const emails: Record<string, string> = {}
    for (const u of list?.users ?? []) {
      if (filtered.includes(u.id)) emails[u.id] = u.email ?? ''
    }
    return NextResponse.json({ emails })
  } catch {
    return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 })
  }
}
