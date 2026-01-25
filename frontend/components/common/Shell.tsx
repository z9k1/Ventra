'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Wallet, Activity, Settings } from 'lucide-react'
import { ReactNode } from 'react'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Sparkles },
  { label: 'Activity', href: '/activity', icon: Activity },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Settings', href: '/settings', icon: Settings }
]

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="relative flex flex-col min-h-screen">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-stroke flex items-center justify-center text-accent">&gt;_</div>
          <div>
            <p className="text-textPrimary font-semibold">Ventra</p>
            <p className="text-textSecondary text-xs">Escrow Pix</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full border border-stroke bg-gradient-to-br from-slate-800 to-slate-900"></div>
      </header>
      <div className="flex-1 pb-28">{children}</div>
      <nav className="fixed left-1/2 bottom-4 -translate-x-1/2 w-[calc(100%-40px)] max-w-[420px] py-3 px-4 rounded-[26px] border border-stroke bg-backdropCard flex justify-between text-xs">
        {navItems.map((item) => {
          const active = pathname?.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-textSecondary">
              <item.icon size={20} className={active ? 'text-accent' : ''} />
              <span className={active ? 'text-accent font-semibold' : ''}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
