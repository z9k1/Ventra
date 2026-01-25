'use client'

import { Terminal } from 'lucide-react'

export function Topbar() {
  return (
    <header className="sticky top-0 z-40 -mx-4 px-4 pt-2 pb-4 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[14px] bg-card border border-border grid place-items-center text-accent">
            <Terminal size={18} />
          </div>
          <div>
            <p className="text-lg font-semibold leading-none">Ventra</p>
            <p className="text-xs text-muted-foreground mt-1">Escrow Pix</p>
          </div>
        </div>
        <div className="h-10 w-10 rounded-full border border-border bg-gradient-to-br from-neutral/30 to-card" />
      </div>
    </header>
  )
}