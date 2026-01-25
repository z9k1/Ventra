import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransactionItem } from './TransactionItem'
import { LocalOrder } from '@/lib/localOrders'

export function TransactionsList({
  orders,
  onClick
}: {
  orders: LocalOrder[]
  onClick: (orderId: string) => void
}) {
  const filterByStatus = (status: string) => orders.filter((order) => order.lastKnownStatus === status)

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Transações Recentes</h2>
      <Tabs defaultValue="ALL">
        <TabsList>
          <TabsTrigger value="ALL">Todos</TabsTrigger>
          <TabsTrigger value="RELEASED">Pago</TabsTrigger>
          <TabsTrigger value="PAID_IN_ESCROW">Aguardando</TabsTrigger>
          <TabsTrigger value="REFUNDED">Cancelado</TabsTrigger>
        </TabsList>
        <TabsContent value="ALL">
          <div className="space-y-3">
            {orders.length === 0 && (
              <div className="ventra-card p-6 text-center text-muted-foreground">
                Nenhuma transação ainda. Crie um novo depósito para começar.
              </div>
            )}
            {orders.map((order) => (
              <TransactionItem key={order.orderId} order={order} onClick={() => onClick(order.orderId)} />
            ))}
          </div>
        </TabsContent>
        {['RELEASED', 'PAID_IN_ESCROW', 'REFUNDED'].map((status) => (
          <TabsContent key={status} value={status}>
            <div className="space-y-3">
              {filterByStatus(status).length === 0 && (
                <div className="ventra-card p-6 text-center text-muted-foreground">Nenhuma transação</div>
              )}
              {filterByStatus(status).map((order) => (
                <TransactionItem key={order.orderId} order={order} onClick={() => onClick(order.orderId)} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
