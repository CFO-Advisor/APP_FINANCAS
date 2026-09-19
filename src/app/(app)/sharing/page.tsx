'use client'

import { useEffect, useState, useCallback } from 'react'
import { UserPlus, Trash2, Loader2, Eye, Pencil, ShieldCheck, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

interface Share {
  id: string
  invitee_id: string
  role: 'viewer' | 'editor'
  invitee_email: string | null
  created_at: string
}

interface IncomingShare {
  owner_id: string
  owner_email: string | null
  role: 'viewer' | 'editor'
}

export default function SharingPage() {
  const [shares, setShares] = useState<Share[]>([])
  const [incoming, setIncoming] = useState<IncomingShare[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer')
  const [inviting, setInviting] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? '')

      // Compartilhamentos que EU concedi
      const { data: mine } = await supabase
        .from('shared_access')
        .select('id, invitee_id, role, created_at')
        .eq('owner_id', user.id)

      // Compartilhamentos que recebi
      const { data: received } = await supabase
        .from('shared_access')
        .select('owner_id, role')
        .eq('invitee_id', user.id)

      // Buscar e-mails dos envolvidos: usa o lookup por auth (fallback: id curto)
      const allIds = [
        ...(mine ?? []).map((s) => s.invitee_id),
        ...(received ?? []).map((s) => s.owner_id),
      ]

      let emailById: Record<string, string> = {}
      if (allIds.length > 0) {
        const res = await fetch('/api/users/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: allIds }),
        })
        if (res.ok) {
          const body = await res.json()
          emailById = body.emails ?? {}
        }
      }

      setShares((mine ?? []).map((s) => ({
        ...s,
        invitee_email: emailById[s.invitee_id] ?? null,
      })))
      setIncoming((received ?? []).map((s) => ({
        owner_id: s.owner_id,
        owner_email: emailById[s.owner_id] ?? null,
        role: s.role,
      })))
    } catch {
      toast.error('Erro ao carregar compartilhamentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Informe um e-mail válido.')
      return
    }
    setInviting(true)
    try {
      const res = await fetch('/api/sharing/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? 'Não foi possível compartilhar.')
        return
      }
      toast.success(`Acesso concedido a ${email} (${inviteRole === 'viewer' ? 'somente leitura' : 'edição'}).`)
      setDialogOpen(false)
      setInviteEmail('')
      await load()
    } catch {
      toast.error('Erro inesperado ao compartilhar.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('shared_access').delete().eq('id', id)
    if (error) {
      toast.error('Não foi possível revogar o acesso.')
      return
    }
    toast.success('Acesso revogado.')
    await load()
  }

  async function handleRoleChange(id: string, role: 'viewer' | 'editor') {
    const supabase = createClient()
    const { error } = await supabase.from('shared_access').update({ role }).eq('id', id)
    if (error) {
      toast.error('Não foi possível alterar o papel.')
      return
    }
    toast.success('Papel atualizado.')
    await load()
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compartilhamento</h1>
          <p className="text-sm text-muted-foreground">
            Conceda acesso aos seus dados financeiros para outras pessoas (ex.: contador, cônjuge).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <UserPlus className="mr-2 h-3.5 w-3.5" />
            Compartilhar
          </Button>
        </div>
      </div>

      {/* Meus compartilhamentos */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Pessoas com acesso aos meus dados
          </CardTitle>
          <CardDescription>
            Você é o proprietário dos dados abaixo. Revogue quando quiser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : shares.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum compartilhamento ativo. Use “Compartilhar” para conceder acesso.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {shares.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.invitee_email ?? 'Usuário'}</p>
                    <p className="text-xs text-muted-foreground">
                      Desde {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={s.role}
                      onValueChange={(v) => void handleRoleChange(s.id, v as 'viewer' | 'editor')}
                    >
                      <SelectTrigger className="h-8 w-[170px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer" className="text-xs">
                          <Eye className="mr-2 inline h-3.5 w-3.5" /> Somente leitura
                        </SelectItem>
                        <SelectItem value="editor" className="text-xs">
                          <Pencil className="mr-2 inline h-3.5 w-3.5" /> Pode editar
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => void handleRevoke(s.id)}
                      title="Revogar acesso"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Acessos que recebi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acessos que recebi</CardTitle>
          <CardDescription>Dados de outras pessoas compartilhados com você.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : incoming.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Ninguém compartilhou dados com você ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {incoming.map((i) => (
                <li key={i.owner_id} className="flex items-center justify-between py-3">
                  <p className="text-sm font-medium">{i.owner_email ?? 'Usuário'}</p>
                  <Badge variant={i.role === 'editor' ? 'default' : 'secondary'} className="text-xs">
                    {i.role === 'editor' ? 'Pode editar' : 'Somente leitura'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Dialog de convite */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar acesso</DialogTitle>
            <DialogDescription>
              A pessoa precisa criar uma conta com este e-mail em /register (se ainda não tiver) —
              o acesso é liberado imediatamente após o cadastro existir.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">E-mail da pessoa</Label>
              <Input
                id="invite-email" type="email" placeholder="pessoa@email.com"
                value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required
              />
            </div>
            <div className="grid gap-2">
              <Label>Nível de acesso</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'viewer' | 'editor')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">
                    <Eye className="mr-2 inline h-3.5 w-3.5" /> Somente leitura — vê tudo, não altera
                  </SelectItem>
                  <SelectItem value="editor">
                    <Pencil className="mr-2 inline h-3.5 w-3.5" /> Pode editar — lança e altera tudo
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={inviting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Conceder acesso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
