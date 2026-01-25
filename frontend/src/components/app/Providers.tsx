'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

import { ToastProviderInternal } from '@/components/ui/use-toast'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient())

  return (
    <QueryClientProvider client={client}>
      <ToastProviderInternal>{children}</ToastProviderInternal>
    </QueryClientProvider>
  )
}