'use client'

import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { differenceInSeconds } from 'date-fns'
import { Copy, Plus, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'

import { apiRequest } from '@/lib/api'
import { createLocalCode, upsertLocalOrder, updateLocalOrder } from '@/lib/localOrders'
import type { Charge, Order } from '@/lib/types'

const schema = z.object({
  amount: z
    .string()
    .min(1, 'Informe um valor')
    .transform((value) => value.replace(',', '.'))
    .refine((value) => !Number.isNaN(Number(value)), 'Valor invalido')
    .refine((value) => Number(value) > 0, 'Valor deve ser maior que 0'),
  currency: z.string().default('BRL')
})

type FormData = z.infer<typeof schema>

type Step =
  | { key: 'form' }
  | { key: 'pix'; order: Order; charge: Charge }

function formatCountdown(expiresAt: string) {
  const seconds = Math.max(0, differenceInSeconds(new Date(expiresAt), new Date()))
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return { seconds, label: `${m}:${s}` }
}

export function NewDepositDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<Step>({ key: 'form' })
  const [status, setStatus] = React.useState<'idle' | 'processing' | 'approved' | 'refunded'>('idle')
  const [busy, setBusy] = React.useState(false)
  const [countdown, setCountdown] = React.useState<{ seconds: number; label: string } | null>(null)

  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      currency: 'BRL'
    }
  })

  React.useEffect(() => {
    if (step.key !== 'pix') return

    const tick = () => setCountdown(formatCountdown(step.charge.expires_at))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [step])

  const create = async (data: FormData) => {
    setBusy(true)
    try {
      const amount_cents = Math.round(Number(data.amount) * 100)

      const order = await apiRequest<Order>('/orders', {
        method: 'POST',
        body: { amount_cents, currency: data.currency },
        action: 'order'
      })

      const charge = await apiRequest<Charge>(`/orders/${order.id}/charges/pix`, {
        method: 'POST',
        action: 'charge'
      })

      upsertLocalOrder({
        orderId: order.id,
        amount_cents: order.amount_cents,
        created_at: order.created_at,
        localCode: createLocalCode(),
        lastKnownStatus: order.status,
        chargeId: charge.id
      })

      setStep({ key: 'pix', order, charge })
      onCreated()

      toast({
        title: 'Deposito criado',
        description: 'Cobrança Pix gerada com sucesso.',
        variant: 'success'
      })
    } catch (error: any) {
      const message = error?.message || 'Falha ao criar deposito'
      toast({ title: 'Erro', description: message, variant: 'destructive' })
      if (String(message).includes('API nao configurada')) {
        setOpen(false)
        router.push('/settings')
      }
    } finally {
      setBusy(false)
    }
  }

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balances'] }),
      queryClient.invalidateQueries({ queryKey: ['deposits'] }),
      step.key === 'pix' && queryClient.invalidateQueries({ queryKey: ['deposit', step.order.id] }),
      step.key === 'pix' && queryClient.invalidateQueries({ queryKey: ['ledger', step.order.id] })
    ].filter(Boolean))
  }

  const simulatePaid = async () => {
    if (step.key !== 'pix') return

    setBusy(true)
    setStatus('processing')
    try {
      await apiRequest(`/charges/${step.charge.id}/simulate-paid`, {
        method: 'POST',
        action: 'simulate-paid'
      })

      const updated = await apiRequest<Order>(`/orders/${step.order.id}`)
      updateLocalOrder(step.order.id, {
        lastKnownStatus: updated.status,
        chargeId: updated.charge?.id ?? step.charge.id
      })
      setStep({ key: 'pix', order: updated, charge: updated.charge ?? step.charge })
      onCreated()

      setStatus('approved')
      setTimeout(async () => {
        await invalidateAll()
        setOpen(false)
        setStatus('idle')
      }, 1000)

    } catch (error: any) {
      setStatus('idle')
      toast({ title: 'Erro', description: error?.message || 'Falha ao simular pagamento', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const release = async () => {
    if (step.key !== 'pix') return

    setBusy(true)
    setStatus('processing')
    try {
      const updated = await apiRequest<Order>(`/orders/${step.order.id}/release`, {
        method: 'POST',
        action: 'release'
      })
      updateLocalOrder(step.order.id, { lastKnownStatus: updated.status })
      setStep({ key: 'pix', order: updated, charge: step.charge })
      onCreated()

      setStatus('approved')
      setTimeout(async () => {
        await invalidateAll()
        setOpen(false)
        setStatus('idle')
      }, 1000)

    } catch (error: any) {
      setStatus('idle')
      toast({ title: 'Erro', description: error?.message || 'Falha ao liberar', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const refund = async () => {
    if (step.key !== 'pix') return

    setBusy(true)
    setStatus('processing')
    try {
      const updated = await apiRequest<Order>(`/orders/${step.order.id}/refund`, {
        method: 'POST',
        action: 'refund'
      })
      updateLocalOrder(step.order.id, { lastKnownStatus: updated.status })
      setStep({ key: 'pix', order: updated, charge: step.charge })
      onCreated()

      setStatus('refunded')
      setTimeout(async () => {
        await invalidateAll()
        setOpen(false)
        setStatus('idle')
      }, 1000)

    } catch (error: any) {
      setStatus('idle')
      toast({ title: 'Erro', description: error?.message || 'Falha ao reembolsar', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const canActions = step.key === 'pix' && step.order.status === 'PAID_IN_ESCROW'

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) setStep({ key: 'form' })
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="w-full h-14 gap-3" disabled={busy}>
          <Plus size={18} /> Novo Depósito
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0">
        {status !== 'idle' && (
          <div className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center transition-all duration-300",
            status === 'processing' ? "bg-accent text-accent-foreground" : "bg-background"
          )}>
            {status === 'processing' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin mb-4" />
                <h3 className="text-xl font-semibold">Processando pagamento...</h3>
              </>
            )}
            {status === 'approved' && (
              <>
                <CheckCircle2 className="h-16 w-16 text-accent mb-4" />
                <h3 className="text-2xl font-bold">Pagamento aprovado</h3>
                <p className="text-muted-foreground mt-2">Valor em custódia.</p>
              </>
            )}
            {status === 'refunded' && (
              <>
                <XCircle className="h-16 w-16 text-destructive mb-4" />
                <h3 className="text-2xl font-bold">Pagamento reembolsado</h3>
                <p className="text-muted-foreground mt-2">O valor foi devolvido ao pagador.</p>
              </>
            )}
          </div>
        )}

        <div className="p-6">
        {step.key === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Novo Depósito</DialogTitle>
              <DialogDescription>Crie uma nova ordem e gere uma cobrança Pix.</DialogDescription>
            </DialogHeader>

            <form className="mt-4 space-y-4" onSubmit={form.handleSubmit(create)}>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">Valor (R$)</label>
                <input
                  className="w-full rounded-[16px] border border-border bg-black/20 px-4 py-3 text-base"
                  placeholder="150.00"
                  inputMode="decimal"
                  {...form.register('amount')}
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-red-400">{form.formState.errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">Moeda</label>
                <input
                  className="w-full rounded-[16px] border border-border bg-black/20 px-4 py-3 text-base"
                  {...form.register('currency')}
                />
              </div>

              <Button type="submit" size="lg" className="w-full h-14" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cobrança Pix</DialogTitle>
              <DialogDescription>Use o EMV abaixo para simular o pagamento no sandbox.</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Expira em</span>
                <span className="font-mono text-foreground">{countdown?.label ?? '--:--'}</span>
              </div>

              <textarea
                readOnly
                value={step.charge.pix_emv}
                className="w-full min-h-[120px] rounded-[16px] border border-border bg-black/20 p-3 text-xs leading-relaxed"
              />

              {step.order.status === 'AWAITING_PAYMENT' && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => {
                      navigator.clipboard.writeText(step.charge.pix_emv)
                      toast({ title: 'Copiado', description: 'EMV copiado para a área de transferência.' })
                    }}
                  >
                    <Copy size={16} className="mr-2" /> Copiar
                  </Button>
                  <Button type="button" className="flex-1" onClick={simulatePaid} disabled={busy}>
                    {busy ? 'Processando...' : 'Simular pagamento'}
                  </Button>
                </div>
              )}

              {canActions && (
                <>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" disabled={busy} onClick={refund}>
                      Reembolsar
                    </Button>
                    <Button type="button" disabled={busy} onClick={release}>
                      Liberar
                    </Button>
                  </div>
                </>
              )}

              {['RELEASED', 'REFUNDED', 'CANCELED'].includes(step.order.status) && (
                <div className="ventra-card p-3 text-center text-sm font-medium text-muted-foreground">
                  Ordem finalizada
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Status: <span className="text-foreground font-semibold">{step.order.status}</span>
              </p>
            </div>
          </>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
