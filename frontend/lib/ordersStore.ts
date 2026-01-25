export type LocalOrder = {
  orderId: string
  amount_cents: number
  created_at: string
  code: string
  lastKnownStatus: string
  chargeId?: string
  expires_at?: string
}

const STORAGE_KEY = 'ventra_orders'

export function loadLocalOrders(): LocalOrder[] {
  if (typeof window === 'undefined') {
    return []
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as LocalOrder[]
  } catch (error) {
    window.localStorage.removeItem(STORAGE_KEY)
    return []
  }
}

export function persistLocalOrders(orders: LocalOrder[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

export function pushOrder(order: LocalOrder) {
  const orders = loadLocalOrders()
  const filtered = orders.filter((o) => o.orderId !== order.orderId)
  const next = [order, ...filtered]
  persistLocalOrders(next)
  return next
}

export function updateOrderStatus(orderId: string, status: string) {
  const orders = loadLocalOrders()
  const next = orders.map((order) =>
    order.orderId === orderId ? { ...order, lastKnownStatus: status } : order
  )
  persistLocalOrders(next)
  return next
}

export function clearLocalOrders() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
