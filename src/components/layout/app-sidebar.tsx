'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  TrendingUp,
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Landmark,
  CreditCard,
  BarChart2,
  AlertCircle,
  LogOut,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/budget', label: 'Orçamento', icon: Target },
  { href: '/investments', label: 'Investimentos', icon: BarChart2 },
  { href: '/debts', label: 'Dívidas e Contas', icon: AlertCircle },
  { href: '/banks', label: 'Bancos', icon: Landmark },
  { href: '/credit-cards', label: 'Cartões', icon: CreditCard },
]

interface NavContentProps {
  pathname: string
  collapsed: boolean
  onNavClick?: () => void
  onSignOut: () => void
}

function NavContent({ pathname, collapsed, onNavClick, onSignOut }: NavContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo + Theme toggle */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-border px-4',
          collapsed ? 'flex-col justify-center gap-1' : 'gap-3'
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #7c6eff, #a78bfa)' }}>
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-none">CFO Advisor</p>
            <p className="truncate text-xs text-muted-foreground">Finanças Pessoais</p>
          </div>
        )}
        <ThemeToggle />
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
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              title={collapsed ? label : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                active
                  ? 'text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              style={active ? { background: 'linear-gradient(135deg, #7c6eff, #a78bfa)' } : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="shrink-0 border-t border-border p-3">
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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Você saiu da sua conta.')
    router.push('/login')
  }

  return (
    <>
      {/* ── Desktop sidebar (flex child, not fixed) ───────── */}
      <aside
        className={cn(
          'relative hidden md:flex flex-col shrink-0 border-r border-border bg-sidebar transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <NavContent
          pathname={pathname}
          collapsed={collapsed}
          onSignOut={handleSignOut}
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
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #7c6eff, #a78bfa)' }}>
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold">CFO Advisor</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer overlay ─────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ─────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-sidebar transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <NavContent
          pathname={pathname}
          collapsed={false}
          onNavClick={() => setMobileOpen(false)}
          onSignOut={handleSignOut}
        />
      </aside>
    </>
  )
}
