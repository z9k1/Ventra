export type Charge = {
  id: string
  order_id?: string
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELED' | string
  expires_at: string
  pix_emv: string
  txid: string
}

export type Order = {
  id: string
  status:
    | 'AWAITING_PAYMENT'
    | 'PAID_IN_ESCROW'
    | 'RELEASED'
    | 'REFUNDED'
    | 'DISPUTED'
    | 'RESOLVED'
    | string
  amount_cents: number
  currency: string
  created_at: string
  updated_at?: string
  charge?: Charge | null
}

export type Balance = {
  available_balance_cents: number
  escrow_balance_cents: number
  total_balance_cents: number
}

export type LedgerEntry = {
  id: string
  order_id: string
  type: string
  amount_cents: number
  direction: string
  account: string
  created_at: string
  meta?: Record<string, unknown>
}