// Preferências de IA do usuário (localStorage).
// A chave da API NUNCA fica aqui — só preferências não sensíveis.

export const AI_MODEL_KEY = 'financas_ai_model'
export const AI_HOLDER_NAMES_KEY = 'financas_holder_names'
export const AI_PROL_ABORE_MAX_KEY = 'financas_prolabore_max'

// Valor até o qual um recebimento da CFO Advisor é tratado como pró-labore.
// Acima disso, a IA classifica como dividendos.
export const DEFAULT_PROL_ABORE_MAX = 10000

export interface AiPrefs {
  model?: string
  // Nomes do próprio titular (ex.: "Celio Gadelha de Oliveira").
  // Entrada/saída com esses nomes é movimentação entre contas → Transferência.
  holderNames: string[]
  proLaboreMax: number
}

export function readAiPrefs(): AiPrefs {
  if (typeof window === 'undefined') {
    return { holderNames: [], proLaboreMax: DEFAULT_PROL_ABORE_MAX }
  }
  let holderNames: string[] = []
  try {
    const raw = localStorage.getItem(AI_HOLDER_NAMES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) holderNames = parsed.filter((n) => typeof n === 'string' && n.trim())
    }
  } catch {
    holderNames = []
  }
  const rawMax = Number(localStorage.getItem(AI_PROL_ABORE_MAX_KEY))
  return {
    model: localStorage.getItem(AI_MODEL_KEY) ?? undefined,
    holderNames,
    proLaboreMax: Number.isFinite(rawMax) && rawMax > 0 ? rawMax : DEFAULT_PROL_ABORE_MAX,
  }
}

export function saveHolderNames(names: string[]): void {
  try { localStorage.setItem(AI_HOLDER_NAMES_KEY, JSON.stringify(names)) } catch { /* ignore */ }
}

export function saveProLaboreMax(value: number): void {
  try { localStorage.setItem(AI_PROL_ABORE_MAX_KEY, String(value)) } catch { /* ignore */ }
}
