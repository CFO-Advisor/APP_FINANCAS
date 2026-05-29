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
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react'

function CfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Suit body — main silhouette */}
      <path
        d="M2 23v-4c0-3.4 2.1-6.2 5-7.4l2.5-.8L12 12.5l2.5-1.7 2.5.8c2.9 1.2 5 4 5 7.4v4H2Z"
        fill="rgba(255,255,255,0.83)"
      />
      {/* Left lapel shadow panel */}
      <path
        d="M12 12.5 L8.5 19.5 H2 V19 C2 17.5 3 15.8 5 14.7 L9.5 11.8 Z"
        fill="rgba(155,140,220,0.35)"
      />
      {/* Right lapel shadow panel */}
      <path
        d="M12 12.5 L15.5 19.5 H22 V19 C22 17.5 21 15.8 19 14.7 L14.5 11.8 Z"
        fill="rgba(155,140,220,0.35)"
      />
      {/* Left lapel edge */}
      <path d="M12 12.5 L8 19" stroke="rgba(255,255,255,0.55)" strokeWidth="0.75" strokeLinecap="round"/>
      {/* Right lapel edge */}
      <path d="M12 12.5 L16 19" stroke="rgba(255,255,255,0.55)" strokeWidth="0.75" strokeLinecap="round"/>
      {/* Shirt collar V */}
      <path
        d="M10.3 11 L12 12.5 L13.7 11"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tie knot */}
      <path d="M10.8 11.3 L12 12.5 L13.2 11.3 Z" fill="rgba(205,190,255,0.9)"/>
      {/* Tie blade */}
      <path d="M11.3 12.5 L10.7 19.5 L12 18.4 L13.3 19.5 L12.7 12.5 Z" fill="rgba(195,178,255,0.82)"/>
      {/* Pocket square */}
      <path
        d="M7 17.2 V19.3 H9.2"
        stroke="rgba(255,255,255,0.52)"
        strokeWidth="0.7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Jacket button */}
      <circle cx="12" cy="21" r="0.55" fill="rgba(155,140,220,0.75)"/>
      {/* Neck */}
      <rect x="10.8" y="9.1" width="2.4" height="2.3" rx="0.5" fill="rgba(255,255,255,0.92)"/>
      {/* Head */}
      <circle cx="12" cy="6.2" r="3.4" fill="white"/>
      {/* Hair */}
      <path
        d="M8.7 5.4 C8.7 3 10.2 2 12 2 C13.8 2 15.3 3 15.3 5.4 C15.1 4.1 13.9 3.3 12 3.3 C10.1 3.3 8.9 4.1 8.7 5.4 Z"
        fill="rgba(200,185,255,0.62)"
      />
    </svg>
  )
}
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

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
]

interface NavContentProps {
  pathname: string
  collapsed: boolean
  onNavClick?: () => void
  onSignOut: () => void
  onNavigate: (href: string) => void
}

function NavContent({ pathname, collapsed, onNavClick, onSignOut, onNavigate }: NavContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo + Theme toggle */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-border px-4',
          collapsed ? 'flex-col justify-center gap-1' : 'gap-3'
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #7c6eff, #a78bfa)' }}>
          <CfoIcon className="h-6 w-6" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black leading-tight tracking-tight">CFO Advisor</p>
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
            <button
              key={href}
              type="button"
              title={collapsed ? label : undefined}
              onClick={() => { onNavigate(href); onNavClick?.() }}
              className={cn(
                'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                active
                  ? 'text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              style={active ? { background: 'linear-gradient(135deg, #7c6eff, #a78bfa)' } : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </button>
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

  function handleNavigate(href: string) {
    router.push(href)
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
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #7c6eff, #a78bfa)' }}>
            <CfoIcon className="h-5 w-5" />
          </div>
          <span className="text-base font-black tracking-tight">CFO Advisor</span>
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
          onNavigate={handleNavigate}
        />
      </aside>
    </>
  )
}
