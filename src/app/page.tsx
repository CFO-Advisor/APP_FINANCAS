import Link from 'next/link'
import { TrendingUp, PieChart, FileDown, Shield, Smartphone, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Finanças</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-slate-800">
                Entrar
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Criar conta grátis
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[600px] overflow-hidden">
        {/* Background with overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.75) 100%), url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'grid\' width=\'40\' height=\'40\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 40 0 L 0 0 0 40\' fill=\'none\' stroke=\'rgba(148,163,184,0.1)\' stroke-width=\'0.5\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100\' height=\'100\' fill=\'url(%23grid)\' /%3E%3C/svg%3E")',
          }}
        />

        {/* Content */}
        <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-center px-4 py-32 sm:px-6 lg:px-8 lg:py-40">
          <h1 className="mb-6 max-w-4xl text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Controle Financeiro Simples
          </h1>
          <p className="mb-8 max-w-2xl text-xl text-gray-300">
            Guiando sua empresa rumo ao sucesso financeiro com soluções personalizadas.
            Registre receitas e despesas, visualize gráficos e exporte relatórios com
            facilidade.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/register">
              <Button
                size="lg"
                className="border border-emerald-500 bg-transparent text-emerald-500 hover:bg-emerald-500 hover:text-white"
              >
                Saiba mais
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Começar agora
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-slate-800 bg-slate-900/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { value: '100%', label: 'Gratuito' },
              { value: 'RLS', label: 'Dados isolados por usuário' },
              { value: 'CSV', label: 'Exportação de dados' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold text-emerald-500">{stat.value}</div>
                <div className="mt-2 text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-white">Tudo que você precisa</h2>
            <p className="text-gray-400">
              Funcionalidades pensadas para simplificar o controle financeiro pessoal.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-emerald-500/50 hover:bg-slate-800/50"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                  <feature.icon className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="mb-2 font-semibold text-white">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white">
            Comece a controlar suas finanças hoje
          </h2>
          <p className="mb-8 text-gray-400">
            Crie sua conta gratuitamente e tenha controle total do seu dinheiro.
          </p>
          <Link href="/register">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-8" size="lg">
              Criar conta grátis
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-sm text-gray-400">
        <p>© {new Date().getFullYear()} Finanças Pessoais. Feito com Next.js e Supabase.</p>
      </footer>
    </div>
  )
}
