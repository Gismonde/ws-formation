import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WS Formation',
  description: 'Plateforme de formations en ligne',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}