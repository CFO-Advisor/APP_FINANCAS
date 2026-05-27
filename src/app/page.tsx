import Link from 'next/link'
import {
  TrendingUp,
  PieChart,
  FileDown,
  Shield,
  Smartphone,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

const features = [
  {
    icon: TrendingUp,
    title: 'Controle Total',
    description:
      'Registre receitas e despesas com facilidade e acompanhe seu saldo em tempo real.',
  },
  {
    icon: PieChart,
    title: 'Gráficos Visuais',
    description:
      'Visualize seus gastos por categoria com gráficos de pizza interativos.',
  },
  {
    icon: FileDown,
    title: 'Exportar CSV',
    description:
      'Exporte suas transações filtradas para Excel com um único clique.',
  },
  {
    icon: Shield,
    title: 'Segurança',
    description:
      'Seus dados são protegidos com autenticação segura e isolados por usuário.',
  },
  {
    icon: Smartphone,
    title: 'Responsivo',
    description:
      'Interface adaptada para desktop e mobile. Acesse de qualquer dispositivo.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard',
    description:
      'Resumo mensal com total de receitas, despesas e saldo de forma clara.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">Finanças</span>
          </div>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>Entrar</Button>
            <Button nativeButton={false} render={<Link href="/register" />}>Criar conta grátis</Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <span className="mb-4 inline-block rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
          Controle financeiro simples
        </span>
        <h1 className="mx-auto mb-6 max-w-3xl text-5xl font-bold tracking-tight text-foreground">
          Suas finanças sob{' '}
          <span className="text-blue-600 dark:text-blue-400">controle total</span>
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-xl text-muted-foreground">
          Registre receitas e despesas, visualize gráficos e exporte relatórios.
          Simples, rápido e gratuito.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" className="px-8" nativeButton={false} render={<Link href="/register" />}>
            Começar agora — é grátis
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Já tenho conta
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/50">
        <div className="container mx-auto grid grid-cols-3 divide-x px-4 py-12">
          {[
            { value: '100%', label: 'Gratuito' },
            { value: 'RLS', label: 'Dados isolados por usuário' },
            { value: 'CSV', label: 'Exportação de dados' },
          ].map((stat) => (
            <div key={stat.label} className="px-6 text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold">Tudo que você precisa</h2>
          <p className="mt-3 text-muted-foreground">
            Funcionalidades pensadas para simplificar o controle financeiro pessoal.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 dark:bg-blue-800 py-20 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">
            Comece a controlar suas finanças hoje
          </h2>
          <p className="mb-8 text-blue-100">
            Crie sua conta gratuitamente e tenha controle total do seu dinheiro.
          </p>
          <Button size="lg" variant="secondary" nativeButton={false} render={<Link href="/register" />}>
            Criar conta grátis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Finanças Pessoais. Feito com Next.js e Supabase.</p>
      </footer>
    </div>
  )
}
