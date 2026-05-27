'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
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

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) {
        toast.error('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
        return
      }

      setSent(true)
    } catch {
      toast.error('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // ── Tela de confirmação ──────────────────────────────────────
  if (sent) {
    return (
      <Card className="w-full max-w-md shadow-md text-center">
        <CardHeader className="pb-2">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <MailCheck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">E-mail enviado!</CardTitle>
          <CardDescription className="text-base">
            Verifique sua caixa de entrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg bg-muted px-4 py-2 text-sm font-medium break-all">
            {email}
          </p>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-left text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            <p className="font-medium mb-1">Próximos passos:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Abra o e-mail de <strong>Finanças Pessoais</strong></li>
              <li>Clique em <strong>"Redefinir senha"</strong></li>
              <li>Crie sua nova senha</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">
            Não encontrou? Verifique a pasta de <strong>spam</strong>.
            O link expira em <strong>1 hora</strong>.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setSent(false)}
          >
            <ArrowLeft className="mr-2 h-3 w-3" />
            Tentar outro e-mail
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // ── Formulário ───────────────────────────────────────────────
  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl">Recuperar senha</CardTitle>
        <CardDescription>
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail cadastrado</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar link de recuperação
          </Button>
          <Link
            href="/login"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar ao login
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
