'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, Landmark, TrendingUp, Package2, ScrollText, CreditCard, AlertCircle, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/csv-export'
import type { Bank, Transaction, CreditCard as CreditCardType, Debt, Asset } from '@/lib/types'

// ── Types ──────────────────────────────────────────────
interface BalanceLine {
  label: string
  value: number
  sublabel?: string
  href?: string
  color: string
}

interface BalanceSide {
  title: string
  accent: string
  lines: BalanceLine[]
  total: number
}

// ── Helper: format as secondary text ──────────────────
function Line({ line }: { line: BalanceLine }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{line.label}</p>
        {line.sublabel && (
          <p className="text-xs text-muted-foreground">{line.sublabel}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="tabular-nums text-sm font-semibold" style={{ color: line.color }}>
          {formatCurrency(line.value)}
        </span>
        {line.href && (
          <Link href={line.href} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────
export default function BalancePage() {
  const [loading, setLoading] = useState(true)
  const [ativos, setAtivos] = useState<BalanceSide | null>(null)
  const [passivos, setPassivos] = useState<BalanceSide | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [
      banksRes,
      txRes,
      investSettingsRes,
      assetsRes,
      debtsRes,
      cardsRes,
    ] = await Promise.all([
      supabase.from('banks').select('*'),
      supabase.from('transactions').select('bank_id, credit_card_id, type, amount, category'),
      supabase.from('investment_settings').select('initial_balance'),
      supabase.from('assets').select('group_type, value'),
      supabase.from('debts').select('*').neq('status', 'paid'),
      supabase.from('credit_cards').select('id, name'),
    ])

    const allTx = (txRes.data ?? []) as Pick<Transaction, 'bank_id' | 'credit_card_id' | 'type' | 'amount' | 'category'>[]
    const rawBanks = (banksRes.data ?? []) as Bank[]
    const allDebts = (debtsRes.data ?? []) as Debt[]
    const allAssets = (assetsRes.data ?? []) as Pick<Asset, 'group_type' | 'value'>[]
    const allCards = (cardsRes.data ?? []) as Pick<CreditCardType, 'id' | 'name'>[]

    // ── 1. Bank balances ─────────────────────────────
    const bankTotals: Record<string, { income: number; expense: number }> = {}
    for (const t of allTx) {
      if (!t.bank_id) continue
      if (t.credit_card_id && t.type !== 'credit_card_payment') continue
      if (!bankTotals[t.bank_id]) bankTotals[t.bank_id] = { income: 0, expense: 0 }
      if (t.type === 'income') bankTotals[t.bank_id].income += t.amount
      else bankTotals[t.bank_id].expense += t.amount
    }
    const bankTotal = rawBanks.reduce((s, b) => {
      const t = bankTotals[b.id] ?? { income: 0, expense: 0 }
      return s + b.initial_balance + t.income - t.expense
    }, 0)

    // ── 2. Investment total ──────────────────────────
    const investTxTotal = allTx
      .filter((t) => t.type === 'investment')
      .reduce((s, t) => s + t.amount, 0)
    const investInitialTotal = (investSettingsRes.data ?? [])
      .reduce((s: number, r: { initial_balance: number }) => s + (r.initial_balance ?? 0), 0)
    const investmentTotal = investTxTotal + investInitialTotal

    // ── 3. Assets ────────────────────────────────────
    const goodsTotal  = allAssets.filter((a) => a.group_type === 'goods').reduce((s, a) => s + a.value, 0)
    const rightsTotal = allAssets.filter((a) => a.group_type === 'rights').reduce((s, a) => s + a.value, 0)

    // ── 4. Debts ─────────────────────────────────────
    const loanRemaining = allDebts
      .filter((d) => d.group_type === 'loans')
      .reduce((s, d) => {
        const paid = (d.installments_paid ?? 0) * d.monthly_amount
        return s + Math.max(0, d.total_amount - paid)
      }, 0)

    const billsMonthly = allDebts
      .filter((d) => d.group_type === 'bills')
      .reduce((s, d) => s + d.monthly_amount, 0)

    const otherTotal = allDebts
      .filter((d) => d.group_type === 'other')
      .reduce((s, d) => s + (d.total_amount > 0 ? d.total_amount : d.monthly_amount), 0)

    // ── 5. Credit card outstanding ───────────────────
    const cardExpenses: Record<string, number>  = {}
    const cardPayments: Record<string, number>  = {}
    for (const t of allTx) {
      if (!t.credit_card_id) continue
      if (t.type === 'expense') {
        cardExpenses[t.credit_card_id] = (cardExpenses[t.credit_card_id] ?? 0) + t.amount
      }
      if (t.type === 'credit_card_payment') {
        cardPayments[t.credit_card_id] = (cardPayments[t.credit_card_id] ?? 0) + t.amount
      }
    }
    const cardOutstanding = allCards.reduce((s, c) => {
      const outstanding = Math.max(0, (cardExpenses[c.id] ?? 0) - (cardPayments[c.id] ?? 0))
      return s + outstanding
    }, 0)

    // ── Assemble sides ───────────────────────────────
    const ativosLines: BalanceLine[] = [
      { label: 'Bancos e Contas',    value: bankTotal,       href: '/banks',        color: '#43e97b', sublabel: `${rawBanks.length} conta${rawBanks.length !== 1 ? 's' : ''}` },
      { label: 'Investimentos',      value: investmentTotal, href: '/investments',  color: '#a78bfa' },
      { label: 'Bens',               value: goodsTotal,      href: '/assets',       color: '#fbbf24' },
      { label: 'Direitos',           value: rightsTotal,     href: '/assets',       color: '#38f9d7' },
    ]
    const ativosTotal = bankTotal + investmentTotal + goodsTotal + rightsTotal

    const passivosLines: BalanceLine[] = [
      { label: 'Cartões de Crédito',             value: cardOutstanding, href: '/credit-cards', color: '#ff6584', sublabel: 'saldo em aberto' },
      { label: 'Empréstimos & Financiamentos',   value: loanRemaining,   href: '/debts',        color: '#f7971e', sublabel: 'saldo devedor' },
      { label: 'Contas a Pagar',                 value: billsMonthly,    href: '/debts',        color: '#38f9d7', sublabel: 'compromisso mensal' },
      { label: 'Outras Obrigações',              value: otherTotal,      href: '/debts',        color: '#a78bfa' },
    ]
    const passivosTotal = cardOutstanding + loanRemaining + billsMonthly + otherTotal

    setAtivos({ title: 'Ativos', accent: '#43e97b', lines: ativosLines, total: ativosTotal })
    setPassivos({ title: 'Passivos', accent: '#ff6584', lines: passivosLines, total: passivosTotal })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const patrimonioLiquido = (ativos?.total ?? 0) - (passivos?.total ?? 0)
  const isPositive = patrimonioLiquido >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Balanço Patrimonial</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada do seu patrimônio</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Patrimônio Líquido hero */}
          <div
            className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-6"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-10 blur-3xl"
              style={{ background: isPositive ? '#43e97b' : '#ff6584' }}
            />
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Patrimônio Líquido
            </p>
            <p
              className="text-4xl font-bold tabular-nums"
              style={{ color: isPositive ? '#43e97b' : '#ff6584' }}
            >
              {formatCurrency(patrimonioLiquido)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isPositive
                ? `Ativos superam passivos em ${formatCurrency(patrimonioLiquido)}`
                : `Passivos superam ativos em ${formatCurrency(Math.abs(patrimonioLiquido))}`}
            </p>

            {/* Mini progress bar showing ativos vs passivos */}
            {ativos && passivos && ativos.total + passivos.total > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Ativos: {formatCurrency(ativos.total)}</span>
                  <span>Passivos: {formatCurrency(passivos.total)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (ativos.total / (ativos.total + passivos.total)) * 100)}%`,
                      background: 'linear-gradient(90deg, #43e97b, #7c6eff)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Two-column layout */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* ATIVOS */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: '#43e97b22', color: '#43e97b' }}
                >
                  <TrendingUp className="h-4 w-4" />
                </span>
                <span className="font-semibold">Ativos</span>
                <span className="ml-auto text-sm font-bold tabular-nums" style={{ color: '#43e97b' }}>
                  {formatCurrency(ativos?.total ?? 0)}
                </span>
              </div>

              {/* Lines */}
              <div className="divide-y divide-border px-5">
                {[
                  { label: 'Bancos e Contas',   icon: Landmark,   color: '#43e97b', href: '/banks',       value: ativos?.lines[0].value ?? 0, sublabel: ativos?.lines[0].sublabel },
                  { label: 'Investimentos',     icon: TrendingUp, color: '#a78bfa', href: '/investments', value: ativos?.lines[1].value ?? 0 },
                  { label: 'Bens',              icon: Package2,   color: '#fbbf24', href: '/assets',      value: ativos?.lines[2].value ?? 0 },
                  { label: 'Direitos',          icon: ScrollText, color: '#38f9d7', href: '/assets',      value: ativos?.lines[3].value ?? 0 },
                ].map(({ label, icon: Icon, color, href, value, sublabel }) => (
                  <div key={label} className="flex items-center gap-3 py-3">
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: color + '22', color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="tabular-nums text-sm font-semibold" style={{ color }}>
                        {formatCurrency(value)}
                      </span>
                      <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total footer */}
              <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Ativos</span>
                <span className="text-base font-bold tabular-nums" style={{ color: '#43e97b' }}>
                  {formatCurrency(ativos?.total ?? 0)}
                </span>
              </div>
            </div>

            {/* PASSIVOS */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: '#ff658422', color: '#ff6584' }}
                >
                  <AlertCircle className="h-4 w-4" />
                </span>
                <span className="font-semibold">Passivos</span>
                <span className="ml-auto text-sm font-bold tabular-nums" style={{ color: '#ff6584' }}>
                  {formatCurrency(passivos?.total ?? 0)}
                </span>
              </div>

              {/* Lines */}
              <div className="divide-y divide-border px-5">
                {[
                  { label: 'Cartões de Crédito',           icon: CreditCard,   color: '#ff6584', href: '/credit-cards', value: passivos?.lines[0].value ?? 0, sublabel: passivos?.lines[0].sublabel },
                  { label: 'Empréstimos & Financiamentos', icon: Landmark,     color: '#f7971e', href: '/debts',        value: passivos?.lines[1].value ?? 0, sublabel: passivos?.lines[1].sublabel },
                  { label: 'Contas a Pagar',               icon: ScrollText,   color: '#38f9d7', href: '/debts',        value: passivos?.lines[2].value ?? 0, sublabel: passivos?.lines[2].sublabel },
                  { label: 'Outras Obrigações',            icon: AlertCircle,  color: '#a78bfa', href: '/debts',        value: passivos?.lines[3].value ?? 0 },
                ].map(({ label, icon: Icon, color, href, value, sublabel }) => (
                  <div key={label} className="flex items-center gap-3 py-3">
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: color + '22', color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="tabular-nums text-sm font-semibold" style={{ color }}>
                        {formatCurrency(value)}
                      </span>
                      <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total footer */}
              <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Passivos</span>
                <span className="text-base font-bold tabular-nums" style={{ color: '#ff6584' }}>
                  {formatCurrency(passivos?.total ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Net worth summary bar */}
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">Ativos:</span>{' '}
                  {formatCurrency(ativos?.total ?? 0)}
                </span>
                <span className="text-border">−</span>
                <span>
                  <span className="font-medium text-foreground">Passivos:</span>{' '}
                  {formatCurrency(passivos?.total ?? 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">=</span>
                <span
                  className="text-xl font-bold tabular-nums"
                  style={{ color: isPositive ? '#43e97b' : '#ff6584' }}
                >
                  {formatCurrency(patrimonioLiquido)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
