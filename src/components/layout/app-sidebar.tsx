'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
// Link is still used for the logo and mobile header logo
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Landmark,
  CreditCard,
  BarChart2,
  AlertCircle,
  Layers,
  Scale,
  LogOut,
  KeyRound,
  Menu,
  X,
  ChevronLeft,
  Calculator,
  Sparkles,
} from 'lucide-react'

function CfoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M20 3 34 11v18L20 37 6 29V11L20 3Z" stroke="#B8860B" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="4.5" fill="#00A3E0" />
    </svg>
  )
}
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { ChangePasswordDialog } from '@/components/layout/change-password-dialog'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/budget', label: 'Orçamento', icon: Target },
  { href: '/investments', label: 'Investimentos', icon: BarChart2 },
  { href: '/debts',   label: 'Dívidas e Contas',   icon: AlertCircle },
  { href: '/assets',  label: 'Bens e Direitos',    icon: Layers      },
  { href: '/balance', label: 'Balanço',             icon: Scale       },
  { href: '/banks',   label: 'Bancos',              icon: Landmark    },
  { href: '/credit-cards', label: 'Cartões', icon: CreditCard },
  { href: '/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/ai-settings', label: 'Config. IA', icon: Sparkles },
]

interface NavContentProps {
  pathname: string
  collapsed: boolean
  isMobile?: boolean
  onCloseDrawer?: () => void
  onNavClick?: () => void
  onSignOut: () => void
  onChangePassword: () => void
  onNavigate: (href: string) => void
}

function NavContent({ pathname, collapsed, isMobile = false, onCloseDrawer, onNavClick, onSignOut, onChangePassword, onNavigate }: NavContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo + Theme toggle / Close button */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center justify-between border-b border-border px-4',
          collapsed ? 'flex-col justify-center gap-1' : 'gap-3'
        )}
      >
        <div className="flex items-center gap-3" style={collapsed ? { flexDirection: 'column' } : {}}>
          <CfoMark className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black leading-tight tracking-tight">CFO Advisor</p>
              <p className="truncate text-xs text-muted-foreground">Finanças Pessoais</p>
            </div>
          )}
        </div>
        {isMobile ? (
          <button
            onClick={onCloseDrawer}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : !collapsed ? (
          <ThemeToggle />
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {!collapsed && (
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Menu
          </p>
        )}
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <button
              key={href}
              type="button"
              title={collapsed ? label : undefined}
              onClick={() => { onNavigate(href); onNavClick?.() }}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-inset ring-sidebar-primary/35'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-sidebar-primary' : 'text-muted-foreground/80 group-hover:text-foreground'
                )}
              />
              {!collapsed && label}
            </button>
          )
        })}
      </nav>

      {/* Account actions */}
      <div className="shrink-0 border-t border-border p-3">
        <button
          onClick={onChangePassword}
          title={collapsed ? 'Alterar senha' : undefined}
          className={cn(
            'mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          <KeyRound className="h-4 w-4 shrink-0" />
          {!collapsed && 'Alterar senha'}
        </button>
        <button
          onClick={onSignOut}
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && 'Sair'}
        </button>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Você saiu da sua conta.')
    router.push('/login')
  }

  function handleNavigate(href: string) {
    router.push(href)
  }

  return (
    <>
      {/* ── Desktop sidebar (sticky: permanece visível ao rolar) ───────── */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen md:flex flex-col shrink-0 border-r border-border bg-sidebar transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <NavContent
          pathname={pathname}
          collapsed={collapsed}
          isMobile={false}
          onSignOut={handleSignOut}
          onChangePassword={() => setPwOpen(true)}
          onNavigate={handleNavigate}
        />

        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[4.5rem] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <ChevronLeft
            className={cn('h-3.5 w-3.5 transition-transform duration-200', collapsed && 'rotate-180')}
          />
        </button>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar/95 backdrop-blur-sm px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <CfoMark className="h-7 w-7 shrink-0" />
          <span className="text-base font-black tracking-tight">CFO Advisor</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
            title="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer overlay ─────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ─────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-sidebar shadow-lg transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent
          pathname={pathname}
          collapsed={false}
          isMobile={true}
          onCloseDrawer={() => setMobileOpen(false)}
          onNavClick={() => setMobileOpen(false)}
          onSignOut={handleSignOut}
          onChangePassword={() => { setPwOpen(true); setMobileOpen(false) }}
          onNavigate={handleNavigate}
        />
      </aside>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  )
}
