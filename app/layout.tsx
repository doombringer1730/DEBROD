import type { Metadata, Viewport } from 'next'
import { Chakra_Petch, Orbitron, Share_Tech_Mono } from 'next/font/google'
import { siteName } from '@/lib/site'
import './globals.css'

const display = Orbitron({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-display' })
const body = Chakra_Petch({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' })
const mono = Share_Tech_Mono({ subsets: ['latin'], weight: '400', variable: '--font-mono' })

export const metadata: Metadata = {
  title: siteName,
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#0d0221',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
