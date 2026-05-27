'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
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
import { Loader2, MailCheck, ArrowLeft, RefreshCw } from 'lucide-react'

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })

      if (error) {
        toast.error(
          error.message === 'User already registered'
            ? 'Este e-mail já está cadastrado.'
            : error.message
        )
        return
      }

      setRegistered(true)
    } catch {
      toast.error('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (error) throw error
      toast.success('E-mail de confirmação reenviado!')
    } catch {
      toast.error('Não foi possível reenviar. Aguarde alguns minutos.')
    } finally {
      setResending(false)
    }
  }

  // ── Tela de sucesso ──────────────────────────────────────────
  if (registered) {
    return (
      <Card className="w-full max-w-md shadow-md text-center">
        <CardHeader className="pb-2">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <MailCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Verifique seu e-mail!</CardTitle>
          <CardDescription className="text-base">
            Enviamos um link de confirmação para:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg bg-muted px-4 py-2 text-sm font-medium break-all">
            {email}
          </p>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-left text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            <p className="font-medium mb-1">O que fazer agora:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Abra sua caixa de entrada do e-mail</li>
              <li>Procure o e-mail de <strong>Finanças Pessoais</strong></li>
              <li>Clique no link <strong>"Confirmar cadastro"</strong></li>
              <li>Volte aqui e faça login</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">
            Não encontrou? Verifique a pasta de <strong>spam</strong> ou lixo eletrônico.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-0">
          <Button className="w-full" render={<Link href="/login" />}>
            Ir para o login
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={resending}
            className="text-muted-foreground"
          >
            {resending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3 w-3" />
            )}
            Reenviar e-mail de confirmação
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRegistered(false)}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 h-3 w-3" />
            Voltar ao cadastro
          </Button>
        </CardFooter>
      </Card>
    )
  }

  // ── Formulário de cadastro ───────────────────────────────────
  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl">Criar conta</CardTitle>
        <CardDescription>
          Preencha os dados abaixo para se cadastrar gratuitamente.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repita a senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar conta
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
