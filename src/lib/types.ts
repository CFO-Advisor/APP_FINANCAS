export type TransactionType = 'income' | 'expense' | 'investment' | 'credit_card_payment'

export type Category = string

export interface Transaction {
  id: string
  user_id: string
  description: string
  amount: number
  date: string
  type: TransactionType
  category: Category
  bank_id: string | null
  credit_card_id: string | null
  created_at: string
}

export interface TransactionFormData {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: Category
}

export interface DashboardSummary {
  totalIncome: number
  totalExpense: number
  totalInvestment: number
  balance: number
}

export interface CategoryTotal {
  name: string
  value: number
  color: string
}

export interface Budget {
  id: string
  user_id: string
  month: number
  year: number
  category: string
  type: TransactionType
  amount: number
  created_at: string
}

export interface BudgetFormData {
  category: string
  type: TransactionType
  amount: number
}

export type BankType = 'checking' | 'savings' | 'investment' | 'wallet' | 'credit'

export interface Bank {
  id: string
  user_id: string
  name: string
  type: BankType
  initial_balance: number
  color: string
  agency: string | null
  account_number: string | null
  created_at: string
}

export interface BankBalance extends Bank {
  totalIncome: number
  totalExpense: number
  balance: number
}

export interface BudgetVsActual {
  category: string
  type: TransactionType
  budgeted: number
  actual: number
  remaining: number
  percentage: number
}

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outros'

export type AssetGroupType = 'goods' | 'rights'

export interface Asset {
  id: string
  user_id: string
  group_type: AssetGroupType
  category: string
  description: string
  value: number
  acquisition_date: string | null
  notes: string | null
  created_at: string
}

export type DebtGroupType = 'loans' | 'bills' | 'other'
export type DebtStatus = 'active' | 'paid' | 'overdue'

export interface Debt {
  id: string
  user_id: string
  group_type: DebtGroupType
  category: string
  description: string
  total_amount: number
  monthly_amount: number
  installments_total: number | null
  installments_paid: number | null
  due_day: number | null
  start_date: string | null
  status: DebtStatus
  notes: string | null
  created_at: string
}

export interface CreditCard {
  id: string
  user_id: string
  name: string
  brand: CardBrand
  color: string
  credit_limit: number
  closing_day: number
  due_day: number
  created_at: string
}

export interface CreditCardBalance extends CreditCard {
  currentFaturaTotal: number
  outstandingBalance: number
  availableCredit: number
  utilizationPct: number
  nextDueDate: string
  nextClosingDate: string
}
