'use client'

import { Link2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransfersPanel } from '@/components/conciliacao/transfers-panel'
import { CardInvoicesPanel } from '@/components/conciliacao/card-invoices-panel'

export default function ConciliacaoPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Link2 className="h-6 w-6" />
          Conciliação
        </h1>
        <p className="text-sm text-muted-foreground">
          Rotina posterior à importação: reconhecer que dois registros, em lugares diferentes,
          são o mesmo dinheiro. O vínculo é só reconhecimento — não altera saldo nenhum.
        </p>
      </div>

      <Tabs defaultValue="transferencias">
        <TabsList className="mb-4">
          <TabsTrigger value="transferencias">Transferências</TabsTrigger>
          <TabsTrigger value="faturas">Faturas de cartão</TabsTrigger>
        </TabsList>

        <TabsContent value="transferencias">
          <TransfersPanel />
        </TabsContent>

        <TabsContent value="faturas">
          <CardInvoicesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
