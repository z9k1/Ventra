'use client'

import * as React from 'react'

import { Topbar } from './Topbar'
import { BottomNav } from './BottomNav'
import { Toaster } from '@/components/ui/toaster'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ventra-frame">
      <Topbar />
      <main className="pb-28">{children}</main>
      <BottomNav />
      <Toaster />
    </div>
  )
}