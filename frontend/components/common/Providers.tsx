'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useQueryClient } from '@/lib/queryClient'

export function Providers({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
