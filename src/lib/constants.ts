export const EXPENSE_CATEGORY_GROUPS = [
  {
    label: '🏠 Casa',
    categories: ['Moradia', 'Aluguel', 'Condomínio', 'Água/Luz/Gás', 'Internet', 'IPTU'],
  },
  {
    label: '🍽️ Alimentação',
    categories: ['Alimentação', 'Supermercado', 'Restaurante', 'Delivery'],
  },
  {
    label: '🚗 Transporte',
    categories: ['Transporte', 'Combustível', 'Uber/Taxi', 'Estacionamento', 'IPVA/Seguro Auto'],
  },
  {
    label: '💊 Saúde',
    categories: ['Saúde', 'Farmácia', 'Plano de Saúde', 'Academia', 'Dentista'],
  },
  {
    label: '📚 Educação',
    categories: ['Educação', 'Escola/Faculdade', 'Cursos', 'Livros'],
  },
  {
    label: '🎬 Lazer',
    categories: ['Lazer', 'Cinema/Teatro', 'Viagem', 'Streaming', 'Assinaturas'],
  },
  {
    label: '👔 Vestuário',
    categories: ['Roupas', 'Calçados', 'Acessórios'],
  },
  {
    label: '💳 Finanças',
    categories: ['Fatura Cartão', 'Empréstimo', 'Seguro', 'Imposto'],
  },
  {
    label: '📦 Outros',
    categories: ['Outros'],
  },
]

export const INCOME_CATEGORY_GROUPS = [
  {
    label: '💼 Trabalho',
    categories: ['Salário', 'Freelance', 'Bônus', 'Comissão', '13º Salário'],
  },
  {
    label: '💰 Rendimentos',
    categories: ['Dividendos', 'Aluguel Recebido', 'Rendimentos', 'Fundos', 'Juros Recebidos'],
  },
  {
    label: '🎁 Extras',
    categories: ['Reembolso', 'Venda', 'Presente', 'Prêmio'],
  },
  {
    label: '📦 Outros',
    categories: ['Outros'],
  },
]

export const INVESTMENT_CATEGORY_GROUPS = [
  {
    label: '🏦 Renda Fixa',
    categories: ['Tesouro Direto', 'CDB', 'LCI/LCA', 'Poupança', 'Debêntures', 'Fundo RF'],
  },
  {
    label: '📈 Renda Variável',
    categories: ['Ações', 'FIIs', 'ETFs', 'BDRs', 'Opções', 'Fundo Ações'],
  },
  {
    label: '₿ Criptoativos',
    categories: ['Bitcoin', 'Ethereum', 'Altcoins', 'Stablecoins', 'DeFi'],
  },
  {
    label: '🏠 Imóveis',
    categories: ['Imóvel Residencial', 'Imóvel Comercial', 'Terreno', 'Reforma/Benfeitorias'],
  },
  {
    label: '📦 Outros Investimentos',
    categories: ['Previdência Privada', 'COE', 'Ouro', 'Câmbio', 'Consórcio', 'Startup/Equity'],
  },
]

export const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_GROUPS.flatMap((g) => g.categories)
export const INCOME_CATEGORIES = INCOME_CATEGORY_GROUPS.flatMap((g) => g.categories)
export const INVESTMENT_CATEGORIES = INVESTMENT_CATEGORY_GROUPS.flatMap((g) => g.categories)
export const CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...INVESTMENT_CATEGORIES])]

// Baseline palette: #6c63ff #43e97b #ff6584 #f7971e #38f9d7 #a78bfa #fbbf24
export const CATEGORY_COLORS: Record<string, string> = {
  // Despesas — Alimentação (pink-red)
  'Alimentação': '#ff6584',
  'Supermercado': '#ff8099',
  'Restaurante': '#ff9aaf',
  'Delivery': '#ffb4c4',
  // Despesas — Transporte (orange)
  'Transporte': '#f7971e',
  'Combustível': '#f9aa40',
  'Uber/Taxi': '#fabd62',
  'Estacionamento': '#fbd08a',
  'IPVA/Seguro Auto': '#fce3b1',
  // Despesas — Moradia (purple)
  'Moradia': '#6c63ff',
  'Aluguel': '#8078ff',
  'Condomínio': '#948eff',
  'Água/Luz/Gás': '#a8a4ff',
  'Internet': '#bcb9ff',
  'IPTU': '#d0ceff',
  // Despesas — Saúde (cyan)
  'Saúde': '#38f9d7',
  'Farmácia': '#61fae0',
  'Plano de Saúde': '#8afbe9',
  'Academia': '#b3fcf2',
  'Dentista': '#dcfefb',
  // Despesas — Educação (light purple)
  'Educação': '#a78bfa',
  'Escola/Faculdade': '#b9a1fb',
  'Cursos': '#cbb7fc',
  'Livros': '#ddcdfd',
  // Despesas — Lazer (green)
  'Lazer': '#43e97b',
  'Cinema/Teatro': '#6eed97',
  'Viagem': '#98f1b3',
  'Streaming': '#bcf5cf',
  'Assinaturas': '#e0f9eb',
  // Despesas — Vestuário (yellow)
  'Roupas': '#fbbf24',
  'Calçados': '#fcc940',
  'Acessórios': '#fdd35b',
  // Despesas — Finanças / Outros
  'Fatura Cartão': '#8892a4',
  'Empréstimo': '#9aa1ad',
  'Seguro': '#acb0b7',
  'Imposto': '#bebfc1',
  'Outros': '#8892a4',
  // Receitas
  'Salário': '#43e97b',
  'Freelance': '#38f9d7',
  'Bônus': '#6c63ff',
  'Comissão': '#a78bfa',
  '13º Salário': '#f7971e',
  'Dividendos': '#43e97b',
  'Aluguel Recebido': '#fbbf24',
  'Rendimentos': '#38f9d7',
  'Fundos': '#6c63ff',
  'Juros Recebidos': '#a78bfa',
  'Reembolso': '#ff6584',
  'Venda': '#f7971e',
  'Presente': '#fbbf24',
  'Prêmio': '#43e97b',
  // Investimentos — Renda Fixa (green shades)
  'Tesouro Direto': '#43e97b',
  'CDB': '#6eed97',
  'LCI/LCA': '#98f1b3',
  'Poupança': '#bcf5cf',
  'Debêntures': '#1ad960',
  'Fundo RF': '#13bb4f',
  // Investimentos — Renda Variável (purple shades)
  'Ações': '#6c63ff',
  'FIIs': '#8078ff',
  'ETFs': '#948eff',
  'BDRs': '#a8a4ff',
  'Opções': '#bcb9ff',
  'Fundo Ações': '#5055e0',
  // Investimentos — Cripto (orange)
  'Bitcoin': '#f7971e',
  'Ethereum': '#a78bfa',
  'Altcoins': '#b9a1fb',
  'Stablecoins': '#cbb7fc',
  'DeFi': '#8b5cf6',
  // Investimentos — Imóveis (yellow)
  'Imóvel Residencial': '#fbbf24',
  'Imóvel Comercial': '#fcc940',
  'Terreno': '#fdd35b',
  'Reforma/Benfeitorias': '#f59e0b',
  // Investimentos — Outros
  'Previdência Privada': '#ff6584',
  'COE': '#ff8099',
  'Ouro': '#fbbf24',
  'Câmbio': '#38f9d7',
  'Consórcio': '#6c63ff',
  'Startup/Equity': '#a78bfa',
}

export const BANK_PRESETS = [
  { name: 'Nubank',          color: '#8B5CF6', initials: 'Nu' },
  { name: 'Itaú',            color: '#F97316', initials: 'IT' },
  { name: 'Bradesco',        color: '#CC0000', initials: 'BR' },
  { name: 'Santander',       color: '#EC0000', initials: 'SN' },
  { name: 'Banco do Brasil', color: '#F5C400', initials: 'BB' },
  { name: 'Caixa',           color: '#0A52A5', initials: 'CX' },
  { name: 'BTG Pactual',     color: '#1E3A8A', initials: 'BTG' },
  { name: 'Inter',           color: '#FF7A00', initials: 'IN' },
  { name: 'C6 Bank',         color: '#374151', initials: 'C6' },
  { name: 'XP',              color: '#111827', initials: 'XP' },
  { name: 'PicPay',          color: '#21C25E', initials: 'PP' },
  { name: 'Mercado Pago',    color: '#009EE3', initials: 'MP' },
  { name: 'Neon',            color: '#00D4AA', initials: 'NE' },
  { name: 'Sicoob',          color: '#007BCC', initials: 'SB' },
  { name: 'Sicredi',         color: '#009639', initials: 'SC' },
  { name: 'Next',            color: '#0DB14B', initials: 'NX' },
] as const

export const BANK_TYPE_LABELS: Record<string, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  investment: 'Investimento',
  wallet: 'Carteira Digital',
  credit: 'Cartão de Crédito',
}

export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outros'

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  amex: 'American Express',
  hipercard: 'Hipercard',
  outros: 'Outros',
}

export const CARD_BRAND_COLORS: Record<CardBrand, string> = {
  visa: '#1A1F71',
  mastercard: '#EB001B',
  elo: '#00A4E0',
  amex: '#007BC1',
  hipercard: '#CC0000',
  outros: '#6366F1',
}

import { Banknote, FileText, AlertCircle, Package2, ScrollText, type LucideIcon } from 'lucide-react'
import type { AssetGroupType, DebtGroupType } from './types'

export interface AssetGroupDef {
  key: AssetGroupType
  label: string
  shortLabel: string
  color: string
  icon: LucideIcon
  categories: string[]
}

export const ASSET_GROUP_DEFS: AssetGroupDef[] = [
  {
    key: 'goods',
    label: 'Bens',
    shortLabel: 'Bens',
    color: '#fbbf24',
    icon: Package2,
    categories: [
      'Imóvel Residencial',
      'Imóvel para Aluguel',
      'Imóvel Comercial',
      'Terreno',
      'Carro',
      'Moto',
      'Veículo Comercial',
      'Embarcação',
      'Joias e Relógios',
      'Obras de Arte',
      'Equipamentos Profissionais',
      'Eletrônicos',
      'Móveis e Utensílios',
      'Outros Bens',
    ],
  },
  {
    key: 'rights',
    label: 'Direitos',
    shortLabel: 'Direitos',
    color: '#38f9d7',
    icon: ScrollText,
    categories: [
      'Empréstimos a Receber',
      'Aluguel a Receber',
      'Dividendos a Receber',
      'Vendas a Prazo',
      'Quotas de Empresa',
      'Ações Não Listadas',
      'Previdência Privada',
      'FGTS',
      'Patentes e Royalties',
      'Depósito em Garantia',
      'Créditos Tributários',
      'Outros Direitos',
    ],
  },
]

export interface DebtGroupDef {
  key: DebtGroupType
  label: string
  shortLabel: string
  color: string
  icon: LucideIcon
  categories: string[]
}

export const DEBT_GROUP_DEFS: DebtGroupDef[] = [
  {
    key: 'loans',
    label: 'Empréstimos & Financiamentos',
    shortLabel: 'Empréstimos',
    color: '#f7971e',
    icon: Banknote,
    categories: [
      'Financiamento Imobiliário',
      'Financiamento de Veículo',
      'Empréstimo Pessoal',
      'Crédito Consignado',
      'Empréstimo Estudantil',
      'Refinanciamento',
      'Outros Empréstimos',
    ],
  },
  {
    key: 'bills',
    label: 'Contas a Pagar',
    shortLabel: 'Contas',
    color: '#38f9d7',
    icon: FileText,
    categories: [
      'Aluguel',
      'Condomínio',
      'Energia Elétrica',
      'Água e Esgoto',
      'Internet',
      'Telefone / Celular',
      'Gás',
      'Plano de Saúde',
      'Escola / Faculdade',
      'IPTU',
      'IPVA',
      'Seguro',
      'Mensalidade',
      'Outras Contas',
    ],
  },
  {
    key: 'other',
    label: 'Outras Obrigações',
    shortLabel: 'Outras',
    color: '#a78bfa',
    icon: AlertCircle,
    categories: [
      'Pensão Alimentícia',
      'Imposto de Renda',
      'Multas e Débitos',
      'Dívida com Familiares',
      'Dívida com Terceiros',
      'Obrigações Trabalhistas',
      'Contribuições',
      'Outras Obrigações',
    ],
  },
]

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
