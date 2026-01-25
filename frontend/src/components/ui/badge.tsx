import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.28em]',
  {
    variants: {
      variant: {
        success: 'bg-success text-success-foreground border-success-foreground/35',
        neutral: 'bg-neutral text-neutral-foreground border-border',
        outline: 'bg-transparent text-foreground border-border'
      }
    },
    defaultVariants: {
      variant: 'neutral'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }