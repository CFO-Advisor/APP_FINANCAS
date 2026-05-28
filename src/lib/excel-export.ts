import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Import template ───────────────────────────────────────────────────────────
export function downloadImportTemplate() {
  // ── Sheet 1: data template ────────────────────────────────
  const templateRows = [
    ['Data',       'Descrição',              'Valor',   'Tipo',         'Categoria'       ],
    ['01/05/2025', 'Salário Maio',            '5000.00', 'Receita',      'Salário'         ],
    ['03/05/2025', 'Supermercado Extra',      '320.50',  'Despesa',      'Alimentação'     ],
    ['08/05/2025', 'Conta de Luz',            '185.00',  'Despesa',      'Água/Luz/Gás'    ],
    ['10/05/2025', 'Tesouro Direto',          '500.00',  'Investimento', 'Tesouro Direto'  ],
    ['12/05/2025', 'Combustível',             '220.00',  'Despesa',      'Combustível'     ],
    ['15/05/2025', 'Freelance Design',        '1200.00', 'Receita',      'Freelance'       ],
    ['20/05/2025', 'Netflix',                 '55.90',   'Despesa',      'Streaming'       ],
    ['22/05/2025', 'Consulta Médica',         '350.00',  'Despesa',      'Saúde'           ],
    ['25/05/2025', 'CDB Banco Inter',         '300.00',  'Investimento', 'CDB'             ],
    ['28/05/2025', '13º Salário (parcial)',   '2500.00', 'Receita',      '13º Salário'     ],
  ]

  const wsData = XLSX.utils.aoa_to_sheet(templateRows)
  wsData['!cols'] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 12 },
    { wch: 16 },
    { wch: 24 },
  ]

  // ── Sheet 2: instructions ─────────────────────────────────
  const instrRows = [
    ['GUIA DE PREENCHIMENTO — Template de Importação de Transações'],
    [],
    ['CAMPOS DA PLANILHA'],
    ['Campo',         'Obrigatório', 'Formato aceito',                              'Exemplos válidos'                            ],
    ['Data',          'Sim',         'dd/mm/aaaa   aaaa-mm-dd   dd-mm-aaaa',       '01/05/2025   2025-05-01   01-05-2025'        ],
    ['Descrição',     'Sim',         'Texto livre (máx. 200 caracteres)',           'Supermercado Extra, Salário Maio'             ],
    ['Valor',         'Sim',         'Número positivo (ponto ou vírgula decimal)', '250.50   1.500,00   350'                      ],
    ['Tipo',          'Não',         'Receita | Despesa | Investimento',            'Despesa  (em branco = auto pelo valor)'      ],
    ['Categoria',     'Não',         'Texto livre — sugestões na aba ao lado',      'Alimentação  (em branco = "Outros")'         ],
    [],
    ['DETECÇÃO AUTOMÁTICA DE TIPO'],
    ['Se a coluna "Tipo" ficar em branco, o sistema detecta:'],
    ['  • Valor positivo → Receita'],
    ['  • Valor negativo (ex: -250.50) → Despesa'],
    [],
    ['CATEGORIAS SUGERIDAS POR TIPO'],
    ['Tipo',          'Categorias disponíveis'                                                                                    ],
    ['Receita',       'Salário · Freelance · Bônus · Comissão · 13º Salário · Dividendos · Aluguel Recebido · Rendimentos · Outros'],
    ['Despesa',       'Alimentação · Supermercado · Transporte · Combustível · Moradia · Aluguel · Saúde · Farmácia · Educação · Lazer · Roupas · Outros'],
    ['Investimento',  'Tesouro Direto · CDB · LCI/LCA · Poupança · Ações · FIIs · ETFs · Bitcoin · Ethereum · Previdência Privada · Outros'],
    [],
    ['DICAS IMPORTANTES'],
    ['  ✓ A primeira linha da aba "Transações" é o cabeçalho — não remova nem altere os nomes'],
    ['  ✓ Deixe "Categoria" em branco para definir como "Outros" (você pode editar depois)'],
    ['  ✓ Não use formatação especial de células — use valores de texto simples'],
    ['  ✓ Valores negativos são interpretados como Despesa automaticamente'],
    ['  ✓ O sistema aceita vírgula ou ponto como separador decimal'],
    ['  ✓ O arquivo gerado pode ter quantas linhas precisar'],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows)
  wsInstr['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 45 }, { wch: 55 }]
  wsInstr['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]

  // ── Assemble workbook ─────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsData, 'Transações')
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções')

  XLSX.writeFile(wb, 'template-importacao-transacoes.xlsx')
}

type ExtratoEntry = {
  tx: {
    date: string
    description: string
    category: string
    type: string
    amount: number
  }
  balanceAfter: number
}

const TYPE_LABELS: Record<string, string> = {
  income:              'Receita',
  expense:             'Despesa',
  investment:          'Investimento',
  credit_card_payment: 'Pg. Fatura',
}

export function exportBankStatementToExcel(
  bankName: string,
  entries: ExtratoEntry[],
) {
  const header = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)', 'Saldo (R$)']

  // Display is newest-first; Excel shows oldest-first (natural reading order)
  const rows = [...entries].reverse().map(({ tx, balanceAfter }) => [
    format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
    tx.description,
    tx.category,
    TYPE_LABELS[tx.type] ?? tx.type,
    tx.type === 'income' ? tx.amount : -tx.amount,
    balanceAfter,
  ])

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  ws['!cols'] = [
    { wch: 12 },
    { wch: 36 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, bankName.slice(0, 31))

  const date = format(new Date(), 'yyyy-MM-dd')
  const safe = bankName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  XLSX.writeFile(wb, `extrato-${safe}-${date}.xlsx`)
}
