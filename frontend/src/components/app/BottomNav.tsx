'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Activity, Wallet, Settings } from 'lucide-react'

import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { href: '/activity', label: 'Activity', Icon: Activity },
  { href: '/wallet', label: 'Wallet', Icon: Wallet },
  { href: '/settings', label: 'Settings', Icon: Settings }
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-32px)] max-w-[430px] -translate-x-1/2">
      <div className="ventra-card px-5 py-3">
        <div className="grid grid-cols-4 gap-2">
          {items.map(({ href, label, Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-[16px] py-2 text-[11px] text-muted-foreground transition',
                  active && 'text-accent'
                )}
              >
                <Icon size={20} className={active ? 'text-accent' : 'text-muted-foreground'} />
                <span className={cn('font-medium', active && 'font-semibold')}>{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}