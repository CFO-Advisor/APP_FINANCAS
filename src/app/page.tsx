import Link from 'next/link'
import { ArrowRight, Check, TrendingUp, PieChart, FileDown, Shield, Smartphone, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

function CfoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M20 3 34 11v18L20 37 6 29V11L20 3Z" stroke="#B8860B" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="4.5" fill="#00A3E0" />
    </svg>
  )
}

const features = [
  {
    icon: TrendingUp,
    title: 'Controle Total',
    description: 'Registre receitas e despesas com facilidade e acompanhe seu saldo em tempo real.',
  },
  {
    icon: PieChart,
    title: 'Gráficos Visuais',
    description: 'Visualize seus gastos por categoria com gráficos de pizza interativos.',
  },
  {
    icon: FileDown,
    title: 'Exportar CSV',
    description: 'Exporte suas transações filtradas para Excel com um único clique.',
  },
  {
    icon: Shield,
    title: 'Segurança',
    description: 'Seus dados são protegidos com autenticação segura e isolados por usuário.',
  },
  {
    icon: Smartphone,
    title: 'Responsivo',
    description: 'Interface adaptada para desktop e mobile. Acesse de qualquer dispositivo.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard',
    description: 'Resumo mensal com total de receitas, despesas e saldo de forma clara.',
  },
]

const steps = [
  { n: '01', title: 'Registre', description: 'Lance receitas e despesas conforme elas acontecem, em segundos.' },
  { n: '02', title: 'Organize', description: 'Categorize, defina orçamentos e acompanhe cartões e dívidas.' },
  { n: '03', title: 'Decida', description: 'Enxergue saldo, gráficos e tendências para decidir com clareza.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <CfoMark className="h-8 w-8" />
            <span className="font-heading text-[15px] font-bold tracking-tight">
              CFO Advisor
              <span className="ml-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Finanças
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" className="h-9 px-4 text-sm font-medium text-muted-foreground hover:text-foreground">
                Entrar
              </Button>
            </Link>
            <Link href="/register">
              <Button className="btn-sweep h-9 border-0 px-4 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-100">
                Criar conta
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="hero-aurora absolute inset-0" aria-hidden="true" />
          <div className="hero-grid absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-24 sm:pt-32">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px] shadow-primary/80" />
                Finanças pessoais, sem complicação
              </p>
              <h1 className="font-heading text-[2.6rem] font-extrabold leading-[1.06] tracking-tight sm:text-6xl">
                Suas finanças, <span className="text-foreground">sob controle</span> de verdade.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Registre receitas e despesas, visualize gráficos e exporte relatórios com facilidade —
                tudo em um único lugar, pensado para o seu dia a dia.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="btn-sweep h-12 border-0 px-7 text-[15px] font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-100">
                    Começar agora <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="h-12 border-white/15 bg-white/[0.03] px-7 text-[15px] font-medium backdrop-blur hover:bg-white/[0.07]">
                    Já tenho conta
                  </Button>
                </Link>
              </div>
              <p className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" /> 100% gratuito
                <span className="mx-1 text-white/20">·</span>
                <Check className="h-3.5 w-3.5 text-primary" /> Dados isolados por usuário
              </p>
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/[0.06]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-3 md:gap-8">
            {steps.map((step) => (
              <div key={step.n} className="relative">
                <span className="font-heading text-sm font-bold tracking-[0.2em] text-primary/70">{step.n}</span>
                <h2 className="font-heading mt-3 text-xl font-bold tracking-tight">{step.title}</h2>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="rule-gradient mx-auto max-w-6xl" aria-hidden="true" />

        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-12 max-w-2xl">
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo que você precisa,<br />sem o que você não usa.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Funcionalidades pensadas para simplificar o controle financeiro pessoal.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="card-hairline group rounded-xl bg-card/60 p-6 ring-1 ring-white/[0.06] transition-colors duration-200 hover:bg-card hover:ring-primary/25"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <feature.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="font-heading text-base font-bold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="card-hairline relative overflow-hidden rounded-2xl bg-card/70 px-8 py-14 text-center ring-1 ring-white/[0.06] sm:px-12">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), transparent 70%)' }}
              aria-hidden="true"
            />
            <h2 className="font-heading relative text-2xl font-bold tracking-tight sm:text-3xl">
              Comece a controlar suas finanças hoje.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Crie sua conta gratuitamente e tenha controle total do seu dinheiro.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="btn-sweep h-12 border-0 px-8 text-[15px] font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-100">
                  Criar conta grátis
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="ghost" className="h-12 px-6 text-[15px] font-medium text-muted-foreground hover:text-foreground">
                  Fazer login
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Finanças Pessoais · Feito com Next.js e Supabase.</p>
          <p className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-primary/60" /> Dados isolados por usuário
          </p>
        </div>
      </footer>
    </div>
  )
}
