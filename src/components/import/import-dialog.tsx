'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, ChevronRight, ChevronLeft, FileDown, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import {
  parseCSVContent,
  parseXLSXContent,
  guessFieldMap,
  mapCSVRows,
  parseOFXContent,
  parsePDFLines,
  type ParsedTransaction,
  type CSVFieldMap,
} from '@/lib/import/parsers'
import { extractStatementLines } from '@/lib/import/pdf'
import { downloadImportTemplate } from '@/lib/excel-export'
import { CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, INVESTMENT_CATEGORIES, TRANSFER_CATEGORY } from '@/lib/constants'
import type { TransactionType } from '@/lib/types'

// Categoria → tipo: quando o usuário troca a categoria no preview, o tipo
// acompanha (ex.: "Terreno" é investimento → vira investimento;
// "Transferência" → vira transferência entre contas).
function categoryToType(cat: string): TransactionType {
  if (cat === TRANSFER_CATEGORY) return 'transfer'
  if (INVESTMENT_CATEGORIES.includes(cat)) return 'investment'
  if (INCOME_CATEGORIES.includes(cat)) return 'income'
  return 'expense'
}
import { AI_MODEL_PREF_KEY } from '@/components/layout/assistant-panel'
import { readAiPrefs } from '@/lib/ai-config'
import type { Bank, CreditCard } from '@/lib/types'

type Step = 'upload' | 'configure' | 'preview' | 'done'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  banks: Bank[]
  creditCards?: CreditCard[]
  onSuccess: () => void
  // Arquivo anexado pelo assistente de IA (painel direito): quando o dialog
  // abre com este arquivo, ele é processado automaticamente como se tivesse
  // sido selecionado no próprio upload.
  pendingFile?: File | null
}

interface FileState {
  name: string
  format: 'csv' | 'ofx' | 'pdf'
  csvHeaders: string[]
  csvRows: Record<string, string>[]
  parsed: ParsedTransaction[]
}

// Extratos bancários brasileiros costumam vir em ISO-8859-1/windows-1252.
// TextDecoder UTF-8 estrito lança para não-UTF-8 → cai no windows-1252.
const utf8 = new TextDecoder('utf-8', { fatal: true })
const latin1 = new TextDecoder('windows-1252')
async function readTextFile(f: File): Promise<string> {
  const buf = await f.arrayBuffer()
  try { return utf8.decode(buf) }
  catch { return latin1.decode(buf) }
}

const CHUNK_SIZE = 100

export function ImportDialog({ open, onOpenChange, banks, creditCards = [], onSuccess, pendingFile }: ImportDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<FileState | null>(null)
  const [fieldMap, setFieldMap] = useState<CSVFieldMap>({ date: '', description: '', amount: '' })
  const [bankId, setBankId] = useState<string>('none')
  // Conta de destino das linhas marcadas como Transferência
  const [transferDestId, setTransferDestId] = useState<string>('none')
  const [creditCardId, setCreditCardId] = useState<string>('none')
  const [loading, setLoading] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiApplied, setAiApplied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload')
    setFile(null)
    setFieldMap({ date: '', description: '', amount: '' })
    setBankId('none')
    setTransferDestId('none')
    setCreditCardId('none')
    setLoading(false)
    setImportedCount(0)
    setErrorCount(0)
    setAiLoading(false)
    setAiApplied(false)
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function processFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase()

    if (ext === 'ofx') {
      const content = await readTextFile(f)
      const parsed = parseOFXContent(content)
      setFile({ name: f.name, format: 'ofx', csvHeaders: [], csvRows: [], parsed })
      setStep('preview')
    } else if (ext === 'pdf') {
      const buffer = await f.arrayBuffer()
      const lines = await extractStatementLines(buffer)
      const parsed = parsePDFLines(lines)
      setFile({ name: f.name, format: 'pdf', csvHeaders: [], csvRows: [], parsed })
      setStep('preview')
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await f.arrayBuffer()
      const { headers, rows } = parseXLSXContent(buffer)
      const guessed = guessFieldMap(headers)
      setFieldMap({
        date: guessed.date ?? '',
        description: guessed.description ?? '',
        amount: guessed.amount ?? '',
        type: guessed.type ?? '',
      })
      setFile({ name: f.name, format: 'csv', csvHeaders: headers, csvRows: rows, parsed: [] })
      setStep('configure')
    } else {
      const content = await readTextFile(f)
      const { headers, rows } = parseCSVContent(content)
      const guessed = guessFieldMap(headers)
      // Se o mapeamento obrigatório foi detectado automaticamente, pula direto
      // pra prévia — o usuário não precisa escolher coluna nenhuna.
      if (guessed.date && guessed.description && guessed.amount) {
        const fm: CSVFieldMap = {
          date: guessed.date,
          description: guessed.description,
          amount: guessed.amount,
          type: guessed.type ?? '',
        }
        setFieldMap(fm)
        setFile({ name: f.name, format: 'csv', csvHeaders: headers, csvRows: rows, parsed: mapCSVRows(rows, fm) })
        setStep('preview')
      } else {
        setFieldMap({
          date: guessed.date ?? '',
          description: guessed.description ?? '',
          amount: guessed.amount ?? '',
          type: guessed.type ?? '',
        })
        setFile({ name: f.name, format: 'csv', csvHeaders: headers, csvRows: rows, parsed: [] })
        setStep('configure')
      }
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  // Arquivo anexado via assistente de IA: processa automaticamente quando o
  // diálogo abre com um pendingFile.
  useEffect(() => {
    if (open && pendingFile) {
      processFile(pendingFile)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingFile])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) processFile(f)
  }

  function handleConfigure() {
    if (!file || !fieldMap.date || !fieldMap.description || !fieldMap.amount) {
      toast.error('Mapeie os campos obrigatórios: Data, Descrição e Valor.')
      return
    }
    const parsed = mapCSVRows(file.csvRows, fieldMap as CSVFieldMap)
    setFile((prev) => prev ? { ...prev, parsed } : prev)
    setStep('preview')
  }

  // Chama a rota server-side /api/ai/classify em lotes e aplica as categorias
  // da IA sobre as linhas válidas. Best-effort: se falhar, mantém as regras.
  async function runAiClassification() {
    if (!file || aiLoading) return
    const valid = file.parsed.filter((r) => !r.error)
    if (valid.length === 0) return
    setAiLoading(true)
    try {
      // Eficiência: deduplica por descrição + valor. Extratos reais repetem muito
      // as mesmas combinações (334 linhas → ~90 únicas), então a IA classifica só
      // as únicas e o resultado é replicado. O valor entra na chave porque as
      // regras do titular (pró-labore x dividendos) dependem dele.
      const itemKey = (r: { description: string; amount: number }) =>
        `${r.description.trim().toLowerCase()}|${r.amount.toFixed(2)}`
      const keyToCat = new Map<string, string>()
      const uniqItems: { key: string; text: string; type: string; amount: number }[] = []
      for (const r of valid) {
        const key = itemKey(r)
        if (keyToCat.has(key)) continue
        uniqItems.push({ key, text: r.description, type: r.type, amount: r.amount })
        keyToCat.set(key, '') // reserva a vaga
      }

      // Regras do titular vêm do Config. IA (nomes + limite de pró-labore)
      const prefs = readAiPrefs()

      const BATCH = 100
      for (let i = 0; i < uniqItems.length; i += BATCH) {
        const slice = uniqItems.slice(i, i + BATCH)
        const res = await fetch('/api/ai/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: prefs.model ?? (typeof window !== 'undefined' ? localStorage.getItem(AI_MODEL_PREF_KEY) ?? undefined : undefined),
            holderNames: prefs.holderNames,
            proLaboreMax: prefs.proLaboreMax,
            items: slice.map((u, j) => ({ index: j, text: u.text, type: u.type, amount: u.amount })),
          }),
        })
        if (!res.ok) break
        const data = await res.json()
        for (const [idx, cat] of Object.entries(data.categories ?? {})) {
          const u = slice[Number(idx)]
          if (u) keyToCat.set(u.key, cat as string)
        }
      }

      // Aplica: replica a categoria da descrição única em todas as linhas
      let applied = 0
      setFile((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          parsed: prev.parsed.map((r) => {
            if (r.error) return r
            const cat = keyToCat.get(itemKey(r))
            if (cat) {
              applied++
              // A categoria manda no tipo: Transferência vira type 'transfer'
              // (o preview então pede as contas de origem e destino)
              return { ...r, category: cat, type: categoryToType(cat) }
            }
            return r
          }),
        }
      })
      if (applied > 0) {
        setAiApplied(true)
        toast.success(`IA classificou ${applied} transaç${applied !== 1 ? 'ões' : 'ão'} (${uniqItems.length} descrições únicas).`)
      } else {
        toast.info('IA indisponível agora — mantida a classificação por regras.')
      }
    } catch {
      toast.info('IA indisponível agora — mantida a classificação por regras.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleImport() {
    if (!file) return
    const validRows = file.parsed.filter((r) => !r.error)
    if (validRows.length === 0) { toast.error('Nenhuma transação válida para importar.'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Não autenticado.'); setLoading(false); return }

    const resolvedBankId = bankId === 'none' ? null : bankId
    const resolvedCardId = creditCardId === 'none' ? null : creditCardId
    const finalBankId = resolvedCardId ? null : resolvedBankId

    // Transferências: exigem as duas contas (mesmo titular) e não vêm de cartão
    const transferCount = validRows.filter((r) => r.type === 'transfer').length
    if (transferCount > 0) {
      if (resolvedCardId) { toast.error('Transferências não podem ser importadas como despesa de cartão.'); setLoading(false); return }
      if (!resolvedBankId) { toast.error('Selecione a conta de ORIGEM das transferências.'); setLoading(false); return }
      if (transferDestId === 'none') { toast.error('Selecione a conta de DESTINO das transferências.'); setLoading(false); return }
      if (resolvedBankId === transferDestId) { toast.error('A conta de destino deve ser diferente da origem.'); setLoading(false); return }
    }

    let imported = 0
    let errors = 0

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE).map((r) => {
        const isTransfer = r.type === 'transfer'
        return {
          user_id: user.id,
          description: r.description,
          amount: r.amount,
          date: r.date,
          // card imports are always expenses; transferência é tipo próprio
          type: isTransfer ? 'transfer' : (resolvedCardId ? 'expense' : r.type),
          category: isTransfer ? TRANSFER_CATEGORY : r.category,
          bank_id: isTransfer ? resolvedBankId : finalBankId,
          credit_card_id: isTransfer ? null : resolvedCardId,
          transfer_bank_id: isTransfer ? transferDestId : null,
        }
      })
      const { error } = await supabase.from('transactions').insert(chunk)
      if (error) errors += chunk.length
      else imported += chunk.length
    }

    setImportedCount(imported)
    setErrorCount(errors)
    setLoading(false)
    setStep('done')
    if (imported > 0) onSuccess()
  }

  const validCount = file?.parsed.filter((r) => !r.error).length ?? 0
  const errorRows = file?.parsed.filter((r) => r.error) ?? []
  // Linhas marcadas como Transferência: exigem conta de origem + destino
  const transferRowsCount = file?.parsed.filter((r) => !r.error && r.type === 'transfer').length ?? 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Transações</DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Template download banner */}
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Precisa de um template?</p>
                <p className="text-xs text-muted-foreground">
                  Baixe nossa planilha Excel pré-formatada com exemplos e instruções.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 text-xs"
                onClick={downloadImportTemplate}
              >
                <FileDown className="h-3.5 w-3.5" />
                Baixar Template
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Suporta <strong>Excel (.xlsx)</strong>, <strong>CSV</strong>, <strong>TXT</strong>, <strong>OFX</strong> e <strong>PDF</strong> (extração simples).
            </p>
            <div
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-muted/30'
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Clique ou arraste o arquivo aqui</p>
                <p className="mt-1 text-xs text-muted-foreground">XLSX, CSV, TXT, OFX, PDF — até 10 MB</p>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.ofx,.pdf"
              className="hidden"
              onChange={handleFileInput}
            />

            {/* Credit card selector */}
            {creditCards.length > 0 && (
              <div className="space-y-1.5">
                <Label>Cartão de crédito (opcional)</Label>
                <Select value={creditCardId} onValueChange={(v) => { if (v) { setCreditCardId(v); if (v !== 'none') setBankId('none') } }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sem cartão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem cartão</SelectItem>
                    {creditCards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {creditCardId !== 'none' && (
                  <p className="text-xs text-muted-foreground">Todos os lançamentos serão vinculados a este cartão como despesas.</p>
                )}
              </div>
            )}

            {/* Bank selector (only when no card selected) */}
            {creditCardId === 'none' && (
              <div className="space-y-1.5">
                <Label>Banco / Conta (opcional)</Label>
                <Select value={bankId} onValueChange={(v) => { if (v) setBankId(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sem banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem banco</SelectItem>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Step: Configure (CSV only) */}
        {step === 'configure' && file && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Arquivo: <span className="font-medium text-foreground">{file.name}</span> — {file.csvRows.length} linha(s) detectada(s).
              Mapeie as colunas do seu arquivo:
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['date', 'description', 'amount', 'type'] as const).map((field) => {
                const labels = { date: 'Data *', description: 'Descrição *', amount: 'Valor *', type: 'Tipo (opcional)' }
                return (
                  <div key={field} className="space-y-1.5">
                    <Label>{labels[field]}</Label>
                    <Select
                      value={fieldMap[field] ?? ''}
                      onValueChange={(v) => setFieldMap((prev) => ({ ...prev, [field]: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar coluna..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field !== 'date' && field !== 'description' && field !== 'amount' && (
                          <SelectItem value="__none__">— Não usar</SelectItem>
                        )}
                        {file.csvHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>

            {/* Preview of first row */}
            {file.csvRows[0] && (
              <div className="rounded-lg bg-muted/40 p-3 text-xs">
                <p className="mb-1 font-medium text-muted-foreground">Prévia da 1ª linha — você pode recategorizar qualquer linha na próxima tela:</p>
                <div className="flex flex-wrap gap-2">
                  {['date', 'description', 'amount', 'type'].map((field) => {
                    const col = fieldMap[field as keyof CSVFieldMap]
                    if (!col) return null
                    return (
                      <span key={field} className="rounded bg-card px-2 py-0.5">
                        <span className="text-muted-foreground">{field}: </span>
                        <span className="font-medium">{file.csvRows[0][col] ?? '—'}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && file && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                {validCount} válida(s)
              </span>
              {errorRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errorRows.length} erro(s)
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="ml-auto gap-1.5 text-xs"
                onClick={runAiClassification}
                disabled={aiLoading || validCount === 0}
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiLoading ? 'Classificando...' : aiApplied ? 'Reclassificar com IA' : 'Classificar com IA'}
              </Button>
            </div>

            {transferRowsCount > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-xs font-medium text-amber-600">
                  {transferRowsCount} lançamento(s) marcado(s) como Transferência — informe as contas (mesmo titular):
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Conta de origem (saída)</Label>
                    <Select value={bankId} onValueChange={(v) => { if (v) { setBankId(v); if (v === transferDestId) setTransferDestId('none') } }}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                      <SelectContent className="max-h-52 overflow-y-auto">
                        <SelectItem value="none">— Selecionar conta</SelectItem>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Conta de destino (entrada)</Label>
                    <Select value={transferDestId} onValueChange={(v) => { if (v) setTransferDestId(v) }}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                      <SelectContent className="max-h-52 overflow-y-auto">
                        <SelectItem value="none">— Selecionar conta</SelectItem>
                        {banks.filter((b) => b.id !== bankId).map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Data</th>
                    <th className="px-3 py-2 text-left font-medium">Descrição</th>
                    <th className="px-3 py-2 text-left font-medium">Categoria</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                    <th className="px-3 py-2 text-left font-medium">Tipo</th>
                    <th className="px-3 py-2 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {file.parsed.map((row, i) => (
                    <tr key={i} className={`border-t border-border ${row.error ? 'bg-destructive/5' : ''}`}>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.date || '—'}</td>
                      <td className="max-w-[200px] truncate px-3 py-1.5">{row.description}</td>
                      <td className="max-w-[130px] px-3 py-1.5">
                        {row.error ? '—' : (
                          <Select
                            value={row.category}
                            onValueChange={(v) => setFile((prev) => {
                              if (!prev) return prev
                              const cat = v ?? 'Outros'
                              return { ...prev, parsed: prev.parsed.map((r, j) => j === i ? { ...r, category: cat, type: categoryToType(cat) } : r) }
                            })}
                          >
                            <SelectTrigger className="h-6 w-full border-none bg-transparent px-1 text-xs shadow-none hover:bg-muted/60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {[...CATEGORIES, TRANSFER_CATEGORY].map((c) => (
                                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${row.type === 'income' ? 'text-emerald-600' : 'text-destructive'}`}>
                        {row.error ? '—' : `R$ ${row.amount.toFixed(2)}`}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {row.type === 'income' ? 'Receita' : row.type === 'investment' ? 'Investimento' : row.type === 'credit_card_payment' ? 'Pagto. Fatura' : row.type === 'transfer' ? 'Transferência' : 'Despesa'}
                      </td>
                      <td className="px-3 py-1.5">
                        {row.error && (
                          <span className="text-destructive" title={row.error}>
                            <AlertCircle className="h-3 w-3" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {errorRows.length > 0 && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <strong>Erros encontrados:</strong>
                <ul className="mt-1 space-y-0.5 list-disc pl-4">
                  {errorRows.slice(0, 5).map((r, i) => <li key={i}>{r.error}</li>)}
                  {errorRows.length > 5 && <li>e mais {errorRows.length - 5}...</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <div>
              <p className="text-lg font-semibold">Importação concluída!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {importedCount} transaç{importedCount !== 1 ? 'ões importadas' : 'ão importada'} com sucesso.
                {errorCount > 0 && ` ${errorCount} falharam.`}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex-row gap-2 pt-2">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}

          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={handleConfigure}>
                Prévia
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(file?.format === 'csv' ? 'configure' : 'upload')}
                disabled={loading}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={loading || validCount === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar {validCount} transaç{validCount !== 1 ? 'ões' : 'ão'}
              </Button>
            </>
          )}

          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
