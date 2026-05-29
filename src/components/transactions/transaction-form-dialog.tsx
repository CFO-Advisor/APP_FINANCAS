'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, X, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  EXPENSE_CATEGORY_GROUPS,
  INCOME_CATEGORY_GROUPS,
  INVESTMENT_CATEGORY_GROUPS,
} from '@/lib/constants'
import { toError } from '@/lib/utils'
import { BankIcon } from '@/components/banks/bank-icon'
import type { Transaction, TransactionFormData, Bank, CreditCard as CreditCardType, TransactionType } from '@/lib/types'
import { format } from 'date-fns'

const NEW_CAT_VALUE = '__new_category__'

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  onSuccess: () => void
  customExpenseCategories: string[]
  customIncomeCategories: string[]
  customInvestmentCategories: string[]
  onAddCategory: (name: string, type: TransactionType) => void
  banks: Bank[]
  creditCards: CreditCardType[]
}

const defaultForm: TransactionFormData = {
  description: '',
  amount: 0,
  date: format(new Date(), 'yyyy-MM-dd'),
  type: 'expense',
  category: 'Alimentação',
}

function getCategoryGroups(type: TransactionType) {
  if (type === 'income') return INCOME_CATEGORY_GROUPS
  if (type === 'investment') return INVESTMENT_CATEGORY_GROUPS
  return EXPENSE_CATEGORY_GROUPS
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
  customExpenseCategories,
  customIncomeCategories,
  customInvestmentCategories,
  onAddCategory,
  banks,
  creditCards,
}: TransactionFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<TransactionFormData>(defaultForm)
  const [bankId, setBankId] = useState<string>('none')
  const [creditCardId, setCreditCardId] = useState<string>('none')
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const newCatInputRef = useRef<HTMLInputElement>(null)

  function getCustomCats(type: TransactionType) {
    if (type === 'income') return customIncomeCategories
    if (type === 'investment') return customInvestmentCategories
    return customExpenseCategories
  }

  const activeGroups = getCategoryGroups(form.type)
  const customCats = getCustomCats(form.type)

  useEffect(() => {
    setShowNewCat(false)
    setNewCatName('')
    if (transaction) {
      setForm({
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date,
        type: transaction.type,
        category: transaction.category,
      })
      setBankId(transaction.bank_id ?? 'none')
      setCreditCardId(transaction.credit_card_id ?? 'none')
    } else {
      setForm(defaultForm)
      setBankId('none')
      setCreditCardId('none')
    }
  }, [transaction, open])

  useEffect(() => {
    if (showNewCat) setTimeout(() => newCatInputRef.current?.focus(), 50)
  }, [showNewCat])

  function updateField<K extends keyof TransactionFormData>(key: K, value: TransactionFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleTypeChange(newType: TransactionType) {
    setShowNewCat(false)
    if (newType === 'credit_card_payment') {
      setForm((prev) => ({
        ...prev,
        type: newType,
        category: 'Pagamento de Fatura',
        description: prev.description || 'Pagamento de Fatura',
      }))
      return
    }
    const groups = getCategoryGroups(newType)
    const allCats = groups.flatMap((g) => g.categories)
    const customList = getCustomCats(newType)
    const allAvailable = [...allCats, ...customList]
    setCreditCardId('none')
    setForm((prev) => ({
      ...prev,
      type: newType,
      category: allAvailable.includes(prev.category) ? prev.category : groups[0].categories[0],
    }))
  }

  function handleCategoryChange(v: string | null) {
    if (!v) return
    if (v === NEW_CAT_VALUE) {
      setShowNewCat(true)
      setNewCatName('')
      return
    }
    setShowNewCat(false)
    updateField('category', v)
  }

  function handleConfirmNewCategory() {
    const name = newCatName.trim()
    if (!name) return
    onAddCategory(name, form.type)
    updateField('category', name)
    setShowNewCat(false)
    setNewCatName('')
  }

  function handleCancelNewCategory() {
    setShowNewCat(false)
    setNewCatName('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (showNewCat) {
      toast.error('Confirme ou cancele a nova categoria antes de salvar.')
      return
    }

    if (!form.description.trim()) {
      toast.error('Informe uma descrição.')
      return
    }

    if (!form.amount || form.amount <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    if (form.type === 'credit_card_payment') {
      if (creditCardId === 'none') { toast.error('Selecione o cartão sendo pago.'); return }
      if (bankId === 'none') { toast.error('Selecione o banco que fará o débito.'); return }
    }

    setLoading(true)
    const supabase = createClient()

    try {
      const resolvedBankId = bankId === 'none' ? null : bankId
      const resolvedCardId = creditCardId === 'none' ? null : creditCardId
      // For payment: both bank and card IDs are kept. For expense: mutually exclusive.
      const finalBankId = form.type === 'credit_card_payment'
        ? resolvedBankId
        : (resolvedCardId ? null : resolvedBankId)
      const finalCategory = form.type === 'credit_card_payment' ? 'Pagamento de Fatura' : form.category

      // Card expenses are pending until the fatura is paid
      const txStatus = (form.type === 'expense' && resolvedCardId) ? 'pending' : 'settled'

      if (transaction) {
        const { error } = await supabase
          .from('transactions')
          .update({
            description: form.description.trim(),
            amount: form.amount,
            date: form.date,
            type: form.type,
            category: finalCategory,
            bank_id: finalBankId,
            credit_card_id: resolvedCardId,
            status: txStatus,
          })
          .eq('id', transaction.id)

        if (error) throw error
        toast.success('Transação atualizada!')
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          description: form.description.trim(),
          amount: form.amount,
          date: form.date,
          type: form.type,
          category: finalCategory,
          bank_id: finalBankId,
          credit_card_id: resolvedCardId,
          status: txStatus,
        })

        if (error) throw error

        // When paying a fatura, settle ALL pending charges for that card
        if (form.type === 'credit_card_payment' && resolvedCardId) {
          const { data: pending } = await supabase
            .from('transactions')
            .select('id')
            .eq('credit_card_id', resolvedCardId)
            .eq('status', 'pending')

          if (pending && pending.length > 0) {
            await supabase
              .from('transactions')
              .update({ status: 'settled' })
              .in('id', pending.map((p) => p.id))

            const cardName = creditCards.find((c) => c.id === resolvedCardId)?.name ?? 'cartão'
            toast.success(
              `${pending.length} lançamento${pending.length !== 1 ? 's' : ''} do ${cardName} registrado${pending.length !== 1 ? 's' : ''} nas categorias!`,
              { duration: 5000 }
            )
          } else {
            toast.success('Pagamento de fatura registrado!')
          }
        } else {
          toast.success('Transação adicionada!')
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      console.error(toError(err))
      toast.error('Erro ao salvar transação.')
    } finally {
      setLoading(false)
    }
  }

  const typeStyles: Record<TransactionType, { active: string; label: string }> = {
    expense: {
      active: 'border-red-500 bg-red-50 text-red-600',
      label: 'Despesa',
    },
    income: {
      active: 'border-green-500 bg-green-50 text-green-600',
      label: 'Receita',
    },
    investment: {
      active: 'border-purple-500 bg-purple-50 text-purple-600',
      label: 'Investimento',
    },
    credit_card_payment: {
      active: 'border-sky-500 bg-sky-50 text-sky-600',
      label: 'Pg. Fatura',
    },
  }

  const submitBtnClass =
    form.type === 'income'
      ? 'bg-green-600 hover:bg-green-700'
      : form.type === 'investment'
      ? 'bg-purple-600 hover:bg-purple-700'
      : form.type === 'credit_card_payment'
      ? 'bg-sky-600 hover:bg-sky-700'
      : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo — 4 buttons */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['income', 'expense', 'investment', 'credit_card_payment'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                  form.type === t
                    ? typeStyles[t].active
                    : 'border-transparent bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                {typeStyles[t].label}
              </button>
            ))}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Almoço, Salário, Tesouro Direto..."
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              required
            />
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={form.amount || ''}
              onChange={(e) => updateField('amount', parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => updateField('date', e.target.value)}
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={showNewCat ? NEW_CAT_VALUE : form.category}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {activeGroups.map((group, i) => (
                  <SelectGroup key={group.label}>
                    {i > 0 && <SelectSeparator />}
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}

                {customCats.length > 0 && (
                  <SelectGroup>
                    <SelectSeparator />
                    <SelectLabel>⭐ Minhas categorias</SelectLabel>
                    {customCats.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                <SelectSeparator />
                <SelectItem value={NEW_CAT_VALUE} className="text-blue-600 font-medium">
                  <Plus className="mr-1 inline h-3 w-3" />
                  Nova categoria...
                </SelectItem>
              </SelectContent>
            </Select>

            {showNewCat && (
              <div className="flex gap-2">
                <Input
                  ref={newCatInputRef}
                  placeholder="Nome da categoria"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleConfirmNewCategory() }
                    if (e.key === 'Escape') handleCancelNewCategory()
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmNewCategory}
                  disabled={!newCatName.trim()}
                >
                  OK
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={handleCancelNewCategory}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Pagamento de fatura — cartão + banco obrigatórios */}
          {form.type === 'credit_card_payment' ? (
            <>
              <div className="space-y-1.5">
                <Label>Cartão sendo pago <span className="text-destructive">*</span></Label>
                {creditCards.length === 0 ? (
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                    <span>Nenhum cartão cadastrado</span>
                    <Link href="/credit-cards" className="ml-2 shrink-0 text-xs font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>
                      Cadastrar →
                    </Link>
                  </div>
                ) : (
                  <Select value={creditCardId} onValueChange={(v) => { if (v) setCreditCardId(v) }}>
                    <SelectTrigger className="w-full">
                      <span className="flex flex-1 items-center gap-2 text-sm">
                        {creditCardId === 'none' ? (
                          <span className="text-muted-foreground">Selecionar cartão...</span>
                        ) : (
                          <>
                            <CreditCard className="h-3.5 w-3.5 shrink-0" style={{ color: creditCards.find((c) => c.id === creditCardId)?.color }} />
                            {creditCards.find((c) => c.id === creditCardId)?.name}
                          </>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="max-h-52 overflow-y-auto">
                      <SelectItem value="none">— Selecionar cartão</SelectItem>
                      <SelectSeparator />
                      {creditCards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <CreditCard className="h-3.5 w-3.5" style={{ color: c.color }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Banco / Conta (débito) <span className="text-destructive">*</span></Label>
                {banks.length === 0 ? (
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                    <span>Nenhum banco cadastrado</span>
                    <Link href="/banks" className="ml-2 shrink-0 text-xs font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>
                      Cadastrar →
                    </Link>
                  </div>
                ) : (
                  <Select value={bankId} onValueChange={(v) => { if (v) setBankId(v) }}>
                    <SelectTrigger className="w-full">
                      <span className="flex flex-1 items-center gap-2 text-sm">
                        {bankId === 'none' ? (
                          <span className="text-muted-foreground">Selecionar banco...</span>
                        ) : (
                          <>
                            <BankIcon name={banks.find((b) => b.id === bankId)?.name ?? ''} color={banks.find((b) => b.id === bankId)?.color ?? ''} size="xs" />
                            {banks.find((b) => b.id === bankId)?.name}
                          </>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="max-h-52 overflow-y-auto">
                      <SelectItem value="none">— Selecionar banco</SelectItem>
                      <SelectSeparator />
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          <span className="flex items-center gap-2">
                            <BankIcon name={b.name} color={b.color} size="xs" />
                            {b.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">O valor será debitado desta conta.</p>
              </div>
            </>
          ) : (
            <>
              {/* Cartão de Crédito (only for expenses) */}
              {form.type === 'expense' && (
                <div className="space-y-1.5">
                  <Label>Cartão de Crédito</Label>
                  {creditCards.length === 0 ? (
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                      <span>Nenhum cartão cadastrado</span>
                      <Link href="/credit-cards" className="ml-2 shrink-0 text-xs font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>
                        Cadastrar cartão →
                      </Link>
                    </div>
                  ) : (
                    <>
                      <Select value={creditCardId} onValueChange={(v) => { if (v) { setCreditCardId(v); if (v !== 'none') setBankId('none') } }}>
                        <SelectTrigger className="w-full">
                          <span className="flex flex-1 items-center gap-2 text-sm">
                            {creditCardId === 'none' ? (
                              <span className="text-muted-foreground">— Sem cartão</span>
                            ) : (
                              <>
                                <CreditCard className="h-3.5 w-3.5 shrink-0" style={{ color: creditCards.find((c) => c.id === creditCardId)?.color }} />
                                {creditCards.find((c) => c.id === creditCardId)?.name}
                              </>
                            )}
                          </span>
                        </SelectTrigger>
                        <SelectContent className="max-h-52 overflow-y-auto">
                          <SelectItem value="none">— Sem cartão</SelectItem>
                          <SelectSeparator />
                          {creditCards.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                <CreditCard className="h-3.5 w-3.5" style={{ color: c.color }} />
                                {c.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {creditCardId !== 'none' && (
                        <p className="text-xs text-muted-foreground">
                          Despesas no cartão não debitam sua conta bancária.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Banco / Conta (hidden when credit card is selected) */}
              {creditCardId === 'none' && (
                <div className="space-y-1.5">
                  <Label>Banco / Conta</Label>
                  {banks.length === 0 ? (
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                      <span>Nenhum banco cadastrado</span>
                      <Link href="/banks" className="ml-2 shrink-0 text-xs font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>
                        Cadastrar banco →
                      </Link>
                    </div>
                  ) : (
                    <Select value={bankId} onValueChange={(v) => { if (v) setBankId(v) }}>
                      <SelectTrigger className="w-full">
                        <span className="flex flex-1 items-center gap-2 text-sm">
                          {bankId === 'none' ? (
                            <span className="text-muted-foreground">— Sem banco</span>
                          ) : (
                            <>
                              <BankIcon name={banks.find((b) => b.id === bankId)?.name ?? ''} color={banks.find((b) => b.id === bankId)?.color ?? ''} size="xs" />
                              {banks.find((b) => b.id === bankId)?.name}
                            </>
                          )}
                        </span>
                      </SelectTrigger>
                      <SelectContent className="max-h-52 overflow-y-auto">
                        <SelectItem value="none">— Sem banco</SelectItem>
                        <SelectSeparator />
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            <span className="flex items-center gap-2">
                              <BankIcon name={b.name} color={b.color} size="xs" />
                              {b.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={submitBtnClass}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {transaction ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
