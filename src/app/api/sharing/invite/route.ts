import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sharing/invite
// Concede acesso do usuário logado (owner) para o e-mail informado.
// Usa service role porque precisa buscar o auth.users pelo e-mail.
export async function POST(req: NextRequest) {
  try {
    const { email, role } = (await req.json()) as { email?: string; role?: string }
    const normalized = (email ?? '').trim().toLowerCase()
    if (!normalized || !/^\S+@\S+\.\S+$/.test(normalized)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }
    const paper = role === 'editor' ? 'editor' : 'viewer'

    // 1) valida sessão do caller (anon)
    const supabaseAnon = await createClient()
    const { data: { user } } = await supabaseAnon.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }
    if (user.email?.toLowerCase() === normalized) {
      return NextResponse.json({ error: 'Você não pode compartilhar com você mesmo.' }, { status: 400 })
    }

    // 2) service role: encontra o usuário-alvo e grava
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
    const targetUser = (list?.users ?? []).find((u) => u.email?.toLowerCase() === normalized)
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Nenhuma conta encontrada com este e-mail. Peça para a pessoa se cadastrar primeiro em /register.' },
        { status: 404 },
      )
    }

    const { error: insertErr } = await service.from('shared_access').upsert(
      { owner_id: user.id, invitee_id: targetUser.id, role: paper },
      { onConflict: 'owner_id,invitee_id' },
    )
    if (insertErr) {
      return NextResponse.json({ error: 'Falha ao conceder acesso.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, invitee_id: targetUser.id, role: paper })
  } catch {
    return NextResponse.json({ error: 'Erro inesperado.' }, { status: 500 })
  }
}
