'use client'

import { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  const base =
    'w-full rounded-[16px] text-sm font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
  const variants = {
    primary: 'bg-accent text-[#0C1016] hover:bg-[#0dd86b]',
    ghost: 'bg-neutralBg text-neutralText border border-stroke hover:border-accent'
  }
  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  )
}
