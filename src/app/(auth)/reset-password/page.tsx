'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('As senhas não conferem.')
      return
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        toast.error('Não foi possível redefinir a senha. O link pode ter expirado.')
        return
      }

      setDone(true)
      setTimeout(() => router.push('/dashboard'), 2500)
    } catch {
      toast.error('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ── Tela de sucesso ──────────────────────────────────────────
  if (done) {
    return (
      <Card className="w-full max-w-md shadow-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Senha redefinida!</CardTitle>
          <CardDescription>
            Sua senha foi atualizada com sucesso. Redirecionando para o dashboard...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // ── Formulário ───────────────────────────────────────────────
  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl">Nova senha</CardTitle>
        <CardDescription>
          Escolha uma senha segura para sua conta.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar nova senha
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
