// Client-side PDF text extraction (worker servido em public/ — build manual de
// node_modules/pdfjs-dist/build/pdf.worker.min.mjs).
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs-worker.min.mjs'

interface TextItem {
  str: string
  transform: number[]
}

/** Extrai o texto de cada página como linhas, reconstruindo a ordem das células por posição (x/y). */
export async function extractStatementLines(buffer: ArrayBuffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  const rows: string[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const items = content.items as TextItem[]

    // Agrupa fragmentos pela linha (y) e ordena pela coluna (x)
    const byRow = new Map<number, Array<{ x: number; str: string }>>()
    for (const it of items) {
      const str = it.str?.trim()
      if (!str) continue
      const y = Math.round(it.transform[5])
      const x = it.transform[4]
      const row = byRow.get(y)
      if (row) row.push({ x, str })
      else byRow.set(y, [{ x, str }])
    }

    for (const cells of byRow.values()) {
      cells.sort((a, b) => a.x - b.x)
      rows.push(cells.map((c) => c.str.replace(/\s+/g, ' ')).join(' '))
    }
  }

  return rows
}