// ── Owner ativo ─────────────────────────────────────────────
// Quando alguém compartilha dados comigo (sou "invitee"), eu vejo os dados
// do dono. Este helper resolve qual user_id usar nas queries/inserts:
//  - sem compartilhamentos → meu próprio id
//  - com compartilhamentos → o dono escolhido (localStorage) ou o primeiro

import { createClient } from '@/lib/supabase/client'

const LS_KEY = 'app-financas:active-owner'

export async function getActiveOwnerId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: shares } = await supabase
    .from('shared_access')
    .select('owner_id, role')
    .eq('invitee_id', user.id)

  if (!shares || shares.length === 0) return user.id

  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null
  if (stored && shares.some((s) => s.owner_id === stored)) return stored
  return shares[0].owner_id
}

export function setActiveOwnerId(id: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(LS_KEY, id)
}

// Papel do usuário em relação ao owner ativo: 'owner' | 'editor' | 'viewer'
export async function getActiveRole(): Promise<'owner' | 'editor' | 'viewer'> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'owner'

  const ownerId = await getActiveOwnerId()
  if (!ownerId || ownerId === user.id) return 'owner'

  const { data: share } = await supabase
    .from('shared_access')
    .select('role')
    .eq('invitee_id', user.id)
    .eq('owner_id', ownerId)
    .maybeSingle()

  return share?.role === 'editor' ? 'editor' : 'viewer'
}
