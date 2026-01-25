export type LocalOrder = {
  orderId: string
  amount_cents: number
  created_at: string
  localCode: string
  lastKnownStatus: string
  chargeId?: string
}

const STORAGE_KEY = 'ventra_orders_v1'

export function loadLocalOrders(): LocalOrder[] {
  if (typeof window === 'undefined') return []

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    return JSON.parse(raw) as LocalOrder[]
  } catch {
    return []
  }
}

export function saveLocalOrders(orders: LocalOrder[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

export function upsertLocalOrder(order: LocalOrder) {
  const current = loadLocalOrders()
  const next = [order, ...current.filter((o) => o.orderId !== order.orderId)]
  saveLocalOrders(next)
  return next
}

export function updateLocalOrder(orderId: string, patch: Partial<LocalOrder>) {
  const current = loadLocalOrders()
  const next = current.map((o) => (o.orderId === orderId ? { ...o, ...patch } : o))
  saveLocalOrders(next)
  return next
}

export function clearLocalOrders() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function createLocalCode() {
  return `VN-${Math.floor(1000 + Math.random() * 9000)}`
}