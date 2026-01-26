import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/format'
import { orderStatusLabel } from '@/lib/labels'

import { LocalOrder } from '@/lib/localOrders'

const statusVariantMap: Record<string, 'success' | 'neutral'> = {
  RELEASED: 'success',
  PAID_IN_ESCROW: 'neutral',
  REFUNDED: 'neutral',
  AWAITING_PAYMENT: 'neutral',
  CANCELED: 'neutral'
}

export function TransactionItem({ order, onClick }: { order: LocalOrder; onClick: () => void }) {
  const label = orderStatusLabel(order.lastKnownStatus)
  const variant = statusVariantMap[order.lastKnownStatus] || 'neutral'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('ventra-card w-full text-left p-4 transition hover:border-accent', 'border border-border')}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-[16px] border border-border bg-black/20 grid place-items-center text-muted-foreground">
            &lt;/&gt;
          </div>
          <div>
            <p className="text-base font-semibold">Pedido {order.localCode}</p>
            <p className="text-sm text-muted-foreground">Custódia Pix · Escrow</p>
          </div>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span className="font-mono">#{order.localCode}</span>
        <span>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(order.created_at))}</span>
        <span className="text-foreground font-semibold">{formatBRL(order.amount_cents)}</span>
      </div>
    </button>
  )
}
