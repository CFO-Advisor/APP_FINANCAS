export type TransactionType = 'income' | 'expense'

export type Category =
  | 'Alimentação'
  | 'Transporte'
  | 'Moradia'
  | 'Lazer'
  | 'Saúde'
  | 'Educação'
  | 'Salário'
  | 'Freelance'
  | 'Outros'

export interface Transaction {
  id: string
  user_id: string
  description: string
  amount: number
  date: string
  type: TransactionType
  category: Category
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
  balance: number
}

export interface CategoryTotal {
  name: string
  value: number
  color: string
}
