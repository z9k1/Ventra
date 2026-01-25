'use client'

import { cn } from '@/lib/utils'

type TabsProps = {
  tabs: { label: string; value: string }[]
  value: string
  onValueChange: (value: string) => void
}

export function Tabs({ tabs, value, onValueChange }: TabsProps) {
  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onValueChange(tab.value)}
          className={cn(
            'flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition',
            value === tab.value
              ? 'border-accent text-accent bg-black/40'
              : 'border-stroke text-textSecondary bg-mutedChip'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
