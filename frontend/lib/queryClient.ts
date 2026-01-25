'use client'

import { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export function useQueryClient() {
  const [client] = useState(() => new QueryClient())
  return client
}
