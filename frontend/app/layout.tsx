import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '@/components/app/Providers'
import { AppShell } from '@/components/app/AppShell'

export const metadata: Metadata = {
  title: 'Ventra Escrow Pix',
  description: 'Ventra style UI for Escrow Pix API'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-background text-foreground">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}