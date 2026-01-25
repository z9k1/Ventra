import { Hourglass } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatBRL } from '@/lib/format'

export function BalanceCards({
  available,
  escrow,
  total
}: {
  available: number
  escrow: number
  total: number
}) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-[14px] border border-border bg-black/25 grid place-items-center">
            <span className="text-lg">¤</span>
          </div>
          <p className="text-base font-medium">Total</p>
        </div>
        <div className="mt-5">
          <p className="text-[42px] font-bold tracking-tight leading-none">{formatBRL(total)}</p>
          <p className="mt-2 text-sm text-accent">
            +12.5% <span className="text-muted-foreground">vs mês anterior</span>
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Disponível</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">{formatBRL(available)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Em custódia</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">{formatBRL(escrow)}</p>
            </div>
            <div className="h-11 w-11 rounded-[14px] border border-border bg-black/20 grid place-items-center">
              <Hourglass className="h-5 w-5 text-neutral-foreground" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
