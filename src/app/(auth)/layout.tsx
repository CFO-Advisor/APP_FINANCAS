import Link from 'next/link'

function CfoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M20 3 34 11v18L20 37 6 29V11L20 3Z" stroke="#B8860B" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="4.5" fill="#00A3E0" />
    </svg>
  )
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-white/[0.07] bg-[oklch(0.135_0.03_255)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="hero-aurora absolute inset-0" aria-hidden="true" />
        <div className="hero-grid absolute inset-0" aria-hidden="true" />

        <Link href="/" className="relative flex items-center gap-2.5">
          <CfoMark className="h-7 w-7" />
          <span className="font-heading text-[15px] font-bold tracking-tight text-foreground">
            CFO Advisor
            <span className="ml-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Finanças
            </span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground">
            Controle financeiro simples para decisões melhores.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground/90">
            Receitas, despesas, orçamento e relatórios em um só lugar.
          </p>
        </div>

        <p className="relative text-xs text-muted-foreground/80">
          © {new Date().getFullYear()} CFO Advisor · Finanças Pessoais
        </p>
      </div>

      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 lg:min-h-0">
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.035), transparent 55%)' }}
          aria-hidden="true"
        />
        <Link href="/" className="relative mb-8 flex items-center gap-2 lg:hidden">
          <CfoMark className="h-7 w-7" />
          <span className="font-heading text-base font-bold tracking-tight">
            CFO Advisor
            <span className="ml-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Finanças
            </span>
          </span>
        </Link>
        <div className="relative w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
