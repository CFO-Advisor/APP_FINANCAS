/** Máximo de fatias exibidas antes de agregar as menores em "Outras". */
export const DONUT_MAX_SLICES = 5

/** Cinza neutro (slate-400) para o agregado "Outras" e categorias sem cor mapeada. */
export const OTHERS_COLOR = '#94A3B8'

export interface DonutSlice {
  name: string
  value: number
  color: string
}

/**
 * Colapsa categorias (já desordenadas ou não) para no máximo DONUT_MAX_SLICES + 1
 * fatias, agregando o restante numa única fatia "Outras". Mantém donut e legenda
 * 1:1, limitando o número de itens da legenda quando o período tem muitas categorias.
 */
export function summarizeDonutData<T extends { name: string; value: number; color?: string }>(
  data: T[]
): DonutSlice[] {
  const sorted = [...data].sort((a, b) => b.value - a.value)

  if (sorted.length <= DONUT_MAX_SLICES) {
    return sorted.map((d) => ({ name: d.name, value: d.value, color: d.color ?? OTHERS_COLOR }))
  }

  const top = sorted.slice(0, DONUT_MAX_SLICES).map((d) => ({
    name: d.name,
    value: d.value,
    color: d.color ?? OTHERS_COLOR,
  }))
  const othersValue = sorted.slice(DONUT_MAX_SLICES).reduce((s, d) => s + d.value, 0)

  return [...top, { name: 'Outras', value: othersValue, color: OTHERS_COLOR }]
}