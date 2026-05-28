'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { INCOME_CATEGORY_GROUPS } from '@/lib/constants'
import { formatCurrency } from '@/lib/csv-export'

interface IncomeCategoryBreakdownProps {
  data: { name: string; value: number }[]
}

export function IncomeCategoryBreakdown({ data }: IncomeCategoryBreakdownProps) {
  const totalIncome = data.reduce((sum, d) => sum + d.value, 0)

  if (totalIncome === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Receitas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma receita neste período.
          </p>
        </CardContent>
      </Card>
    )
  }

  const categoryMap = new Map(data.map((d) => [d.name, d.value]))

  // Agrupamentos definidos + categorias customizadas não mapeadas
  const knownCats = new Set(INCOME_CATEGORY_GROUPS.flatMap((g) => g.categories))
  const customData = data.filter((d) => !knownCats.has(d.name))

  const groups = [
    ...INCOME_CATEGORY_GROUPS.map((g) => ({
      label: g.label,
      items: g.categories
        .filter((cat) => categoryMap.has(cat))
        .map((cat) => ({ name: cat, value: categoryMap.get(cat)! })),
    })).filter((g) => g.items.length > 0),
    ...(customData.length > 0
      ? [{ label: '⭐ Minhas categorias', items: customData }]
      : []),
  ]

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Receitas por Categoria</CardTitle>
        <span className="text-sm font-semibold text-green-600">
          {formatCurrency(totalIncome)}
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => {
          const groupTotal = group.items.reduce((s, i) => s + i.value, 0)
          return (
            <div key={group.label}>
              {/* Cabeçalho do grupo */}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {formatCurrency(groupTotal)}
                  <span className="ml-1 text-xs text-muted-foreground/60">
                    ({((groupTotal / totalIncome) * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>

              {/* Itens do grupo */}
              <div className="space-y-2">
                {group.items
                  .sort((a, b) => b.value - a.value)
                  .map((item) => {
                    const pct = (item.value / totalIncome) * 100
                    return (
                      <div key={item.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-foreground">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {pct.toFixed(1)}%
                            </span>
                            <span className="w-24 text-right font-medium text-green-600">
                              {formatCurrency(item.value)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-green-500/15">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
