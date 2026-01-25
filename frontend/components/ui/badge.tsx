'use client'

import { cn } from '@/lib/utils'

type BadgeProps = {
  variant?: 'success' | 'neutral' | 'ghost'
  children: React.ReactNode
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  const className = cn(
    'px-3 py-1 text-[10px] uppercase tracking-[0.3em] rounded-full border',
    variant === 'success'
      ? 'bg-successBg text-successText border-successText/40'
      : 'bg-neutralBg text-neutralText border-neutralBg'
  )
  return <span className={className}>{children}</span>
}
