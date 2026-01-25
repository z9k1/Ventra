import * as React from 'react'

type ToastVariant = 'default' | 'success' | 'destructive'

export type ToastState = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  open: boolean
}

type ToastAction =
  | { type: 'ADD'; toast: ToastState }
  | { type: 'DISMISS'; id: string }
  | { type: 'REMOVE'; id: string }

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 4000

function reducer(state: ToastState[], action: ToastAction) {
  switch (action.type) {
    case 'ADD': {
      const next = [action.toast, ...state].slice(0, TOAST_LIMIT)
      return next
    }
    case 'DISMISS':
      return state.map((toast) => (toast.id === action.id ? { ...toast, open: false } : toast))
    case 'REMOVE':
      return state.filter((toast) => toast.id !== action.id)
    default:
      return state
  }
}

const ToastContext = React.createContext<{
  toasts: ToastState[]
  toast: (toast: Omit<ToastState, 'id' | 'open'>) => void
  dismiss: (id: string) => void
} | null>(null)

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2)
}

export function ToastProviderInternal({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = React.useReducer(reducer, [])

  const toast = React.useCallback((data: Omit<ToastState, 'id' | 'open'>) => {
    const id = randomId()
    dispatch({ type: 'ADD', toast: { id, open: true, ...data } })

    window.setTimeout(() => {
      dispatch({ type: 'DISMISS', id })
      window.setTimeout(() => dispatch({ type: 'REMOVE', id }), 300)
    }, TOAST_REMOVE_DELAY)
  }, [])

  const dismiss = React.useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id })
    window.setTimeout(() => dispatch({ type: 'REMOVE', id }), 300)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProviderInternal')
  }
  return context
}

