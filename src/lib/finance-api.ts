// BCB API types
export interface BcbRateEntry {
  data: string // "DD/MM/YYYY"
  valor: string // "10.50"
}

export interface BcbSeriesEntry {
  data: string // "01/MM/YYYY"
  valor: string // "0.42"
}

// Frankfurter API types
export interface FrankfurterResponse {
  amount: number
  base: string // "BRL"
  date: string // "YYYY-MM-DD"
  rates: Record<string, number>
}

// Generic result wrapper
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// Fetch SELIC rate (series 11) from BCB
export async function fetchSelicRate(): Promise<ApiResult<number>> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json',
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    if (!res.ok) {
      return { ok: false, error: 'Não foi possível obter a taxa SELIC. Verifique sua conexão.' }
    }

    const data = (await res.json()) as BcbRateEntry[]
    if (!data || data.length === 0) {
      return { ok: false, error: 'Nenhum dado SELIC disponível no momento.' }
    }

    const rate = parseFloat(data[0].valor)
    return { ok: true, data: rate }
  } catch {
    return { ok: false, error: 'Não foi possível obter a taxa SELIC. Verifique sua conexão.' }
  }
}

// Fetch CDI rate (series 12) from BCB
export async function fetchCdiRate(): Promise<ApiResult<number>> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json',
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    if (!res.ok) {
      return { ok: false, error: 'Não foi possível obter a taxa CDI. Verifique sua conexão.' }
    }

    const data = (await res.json()) as BcbRateEntry[]
    if (!data || data.length === 0) {
      return { ok: false, error: 'Nenhum dado CDI disponível no momento.' }
    }

    const rate = parseFloat(data[0].valor)
    return { ok: true, data: rate }
  } catch {
    return { ok: false, error: 'Não foi possível obter a taxa CDI. Verifique sua conexão.' }
  }
}

// Fetch inflation series (IPCA=433, IGP-M=189) from BCB
export async function fetchInflationSeries(
  indexCode: 433 | 189,
  startDate: string, // "DD/MM/YYYY"
  endDate: string // "DD/MM/YYYY"
): Promise<ApiResult<BcbSeriesEntry[]>> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${indexCode}/dados?formato=json&dataInicial=${startDate}&dataFinal=${endDate}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return { ok: false, error: 'Não foi possível obter dados de inflação. Verifique sua conexão.' }
    }

    const data = (await res.json()) as BcbSeriesEntry[]
    if (!data || data.length === 0) {
      return { ok: false, error: 'Nenhum dado encontrado para o período informado.' }
    }

    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Não foi possível obter dados de inflação. Verifique sua conexão.' }
  }
}

// Fallback rates when API is unavailable (approximate current rates)
const FALLBACK_RATES: Record<string, number> = {
  USD: 0.20,
  EUR: 0.22,
  GBP: 0.25,
  ARS: 19.5,
  JPY: 30.0,
  CLP: 170.0,
  PYG: 1400.0,
  UYU: 7.5,
}

// Fetch exchange rates from Frankfurter (BRL base)
export async function fetchExchangeRates(): Promise<ApiResult<FrankfurterResponse>> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch('https://api.frankfurter.app/latest?from=BRL', {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      // Return fallback rates instead of error
      return {
        ok: true,
        data: {
          amount: 1,
          base: 'BRL',
          date: new Date().toISOString().split('T')[0],
          rates: FALLBACK_RATES,
        },
      }
    }

    const data = (await res.json()) as FrankfurterResponse
    if (!data || !data.rates) {
      // Return fallback rates
      return {
        ok: true,
        data: {
          amount: 1,
          base: 'BRL',
          date: new Date().toISOString().split('T')[0],
          rates: FALLBACK_RATES,
        },
      }
    }

    return { ok: true, data }
  } catch {
    // Return fallback rates on any error
    return {
      ok: true,
      data: {
        amount: 1,
        base: 'BRL',
        date: new Date().toISOString().split('T')[0],
        rates: FALLBACK_RATES,
      },
    }
  }
}
