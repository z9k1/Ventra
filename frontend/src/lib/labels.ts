export const ORDER_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PAID_IN_ESCROW: 'Em custódia',
  RELEASED: 'Liberado',
  REFUNDED: 'Reembolsado',
  CANCELED: 'Cancelado',
  DISPUTED: 'Em disputa',
  RESOLVED: 'Resolvido'
}

export const CHARGE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado'
}

export const LEDGER_TYPE_LABELS: Record<string, { title: string; subtitle?: string }> = {
  PAYMENT_CONFIRMED: { title: 'Pagamento confirmado', subtitle: 'Depósito via Pix' },
  ESCROW_HELD: { title: 'Valor em custódia', subtitle: 'Aguardando liberação' },
  RELEASED_TO_MERCHANT: { title: 'Liberado ao recebedor', subtitle: 'Transferência concluída' },
  REFUNDED_TO_CUSTOMER: { title: 'Reembolsado ao pagador', subtitle: 'Valor devolvido' }
}

/**
 * Retorna o rótulo em PT-BR para um status de ordem.
 */
export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status || 'Desconhecido'
}

/**
 * Retorna o rótulo em PT-BR para um status de cobrança.
 */
export function chargeStatusLabel(status: string): string {
  return CHARGE_STATUS_LABELS[status] || status || 'Desconhecido'
}

/**
 * Retorna o título e subtítulo em PT-BR para um tipo de entrada no ledger.
 */
export function ledgerEntryLabel(type: string): { title: string; subtitle?: string } {
  const label = LEDGER_TYPE_LABELS[type]
  if (label) return label

  // Fallback: formata o type original (ex: SOME_EVENT -> Some event)
  const formatted = type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())

  return { title: formatted }
}
