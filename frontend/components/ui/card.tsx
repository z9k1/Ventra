'use client'

import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card-base p-4', className)}>
      {children}
    </div>
  )
}
