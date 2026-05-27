import type { Category } from './types'

export const CATEGORIES: Category[] = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Educação',
  'Salário',
  'Freelance',
  'Outros',
]

export const EXPENSE_CATEGORIES: Category[] = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Educação',
  'Outros',
]

export const INCOME_CATEGORIES: Category[] = [
  'Salário',
  'Freelance',
  'Outros',
]

export const CATEGORY_COLORS: Record<string, string> = {
  'Alimentação': '#FF6384',
  'Transporte': '#36A2EB',
  'Moradia': '#FFCE56',
  'Lazer': '#4BC0C0',
  'Saúde': '#9966FF',
  'Educação': '#FF9F40',
  'Salário': '#22C55E',
  'Freelance': '#06B6D4',
  'Outros': '#94A3B8',
}

export const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]
