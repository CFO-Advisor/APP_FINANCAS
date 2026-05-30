'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
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
import Link from 'next/link'

type Status = 'loading' | 'ready' | 'done' | 'invalid'

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let resolved = false

    function resolve(next: Status) {
      if (!resolved) {
        resolved = true
        setStatus(next)
      }
    }

    // PKCE flow: Supabase redireciona com ?code=xxx na URL
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        resolve(error ? 'invalid' : 'ready')
      })
      return
    }

    // Implicit flow: Supabase redireciona com #access_token=...&type=recovery no hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        resolve('ready')
      }
    })

    // Fallback: se em 2s nenhum evento chegou, verifica sessão existente
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      resolve(session ? 'ready' : 'invalid')
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

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

    setSaving(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        toast.error('Não foi possível redefinir a senha. Solicite um novo link.')
        return
      }

      setStatus('done')
      setTimeout(() => { window.location.href = '/dashboard' }, 2500)
    } catch {
      toast.error('Ocorreu um erro. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Verificando link ─────────────────────────────────────────
  if (status === 'loading') {
    return (
      <Card className="w-full max-w-md shadow-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900/30">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          </div>
          <CardTitle className="text-2xl">Verificando link...</CardTitle>
          <CardDescription>Aguarde um momento.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // ── Link inválido ou expirado ────────────────────────────────
  if (status === 'invalid') {
    return (
      <Card className="w-full max-w-md shadow-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Link inválido</CardTitle>
          <CardDescription>
            Este link expirou ou já foi utilizado. Solicite um novo link de recuperação.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button>
            Solicitar novo link
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // ── Senha redefinida com sucesso ─────────────────────────────
  if (status === 'done') {
    return (
      <Card className="w-full max-w-md shadow-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
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
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar nova senha
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
