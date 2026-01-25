import './globals.css'
import { Providers } from '@/components/common/Providers'
import { Shell } from '@/components/common/Shell'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Ventra Escrow Pix',
  description: 'Painel Ventra-style para Escrow Pix API'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-backdrop text-textPrimary">
        <Providers>
          <div className="main-shell">
            <Shell>{children}</Shell>
          </div>
        </Providers>
      </body>
    </html>
  )
}
