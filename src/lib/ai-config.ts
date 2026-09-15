// Preferências de IA do usuário (localStorage).
// A chave da API NUNCA fica aqui — só preferências não sensíveis.

export const AI_MODEL_KEY = 'financas_ai_model'
export const AI_HOLDER_NAMES_KEY = 'financas_holder_names'
export const AI_PROL_ABORE_MAX_KEY = 'financas_prolabore_max'

// Valor até o qual um recebimento da CFO Advisor é tratado como pró-labore.
// Acima disso, a IA classifica como dividendos.
export const DEFAULT_PROL_ABORE_MAX = 10000

// Regras personalizadas: quando a descrição contiver `match`, a IA usa
// `category` (ex.: "Claro" → Internet).
export const AI_RULES_KEY = 'financas_ai_rules'

export interface CustomRule {
  match: string
  category: string
}

export interface AiPrefs {
  model?: string
  // Nomes do próprio titular (ex.: "Celio Gadelha de Oliveira").
  // Entrada/saída com esses nomes é movimentação entre contas → Transferência.
  holderNames: string[]
  proLaboreMax: number
  rules: CustomRule[]
}

export function readAiPrefs(): AiPrefs {
  if (typeof window === 'undefined') {
    return { holderNames: [], proLaboreMax: DEFAULT_PROL_ABORE_MAX, rules: [] }
  }
  let holderNames: string[] = []
  let rules: CustomRule[] = []
  try {
    const raw = localStorage.getItem(AI_HOLDER_NAMES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) holderNames = parsed.filter((n) => typeof n === 'string' && n.trim())
    }
  } catch {
    holderNames = []
  }
  try {
    const raw = localStorage.getItem(AI_RULES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        rules = parsed.filter(
          (r) => r && typeof r.match === 'string' && r.match.trim() && typeof r.category === 'string' && r.category.trim(),
        )
      }
    }
  } catch {
    rules = []
  }
  const rawMax = Number(localStorage.getItem(AI_PROL_ABORE_MAX_KEY))
  return {
    model: localStorage.getItem(AI_MODEL_KEY) ?? undefined,
    holderNames,
    proLaboreMax: Number.isFinite(rawMax) && rawMax > 0 ? rawMax : DEFAULT_PROL_ABORE_MAX,
    rules,
  }
}

export function saveHolderNames(names: string[]): void {
  try { localStorage.setItem(AI_HOLDER_NAMES_KEY, JSON.stringify(names)) } catch { /* ignore */ }
}

export function saveProLaboreMax(value: number): void {
  try { localStorage.setItem(AI_PROL_ABORE_MAX_KEY, String(value)) } catch { /* ignore */ }
}

export function saveCustomRules(rules: CustomRule[]): void {
  try { localStorage.setItem(AI_RULES_KEY, JSON.stringify(rules)) } catch { /* ignore */ }
}

// Categorias personalizadas ficam no navegador (mesma chave usada na tela de
// transações). O servidor não as conhece, então elas precisam ser enviadas
// junto nas chamadas de classificação.
const CUSTOM_CAT_KEY = 'financas_custom_categories_v3'

export function readCustomCategories(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_CAT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { expense?: string[]; income?: string[]; investment?: string[] }
    return [...(parsed.expense ?? []), ...(parsed.income ?? []), ...(parsed.investment ?? [])].filter(
      (c) => typeof c === 'string' && c.trim(),
    )
  } catch {
    return []
  }
}
