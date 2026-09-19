'use client'

import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação da nova senha não confere.')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      // Verifica a senha atual tentando um login (não afeta a sessão atual)
      const { data: sessionData } = await supabase.auth.getSession()
      const email = sessionData.session?.user.email
      if (!email) {
        toast.error('Não foi possível identificar seu usuário. Faça login novamente.')
        return
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (signInError) {
        toast.error('Senha atual incorreta.')
        return
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        toast.error('Não foi possível alterar a senha: ' + error.message)
        return
      }

      toast.success('Senha alterada com sucesso!')
      onOpenChange(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast.error('Erro inesperado ao alterar a senha. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Alterar senha
          </DialogTitle>
          <DialogDescription>
            Defina uma nova senha para acessar sua conta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleChangePassword} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Alterar senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
