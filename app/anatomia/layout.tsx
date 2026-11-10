import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, Inter } from 'next/font/google'
import './anatomia.css'

const serif = Instrument_Serif({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--an-serif' })
const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--an-sans' })

export const metadata: Metadata = { title: 'Anatomía' }
export const viewport: Viewport = { themeColor: '#111111' }

export default function AnatomiaLayout({ children }: { children: React.ReactNode }) {
  return <div className={`an-root ${serif.variable} ${sans.variable}`}>{children}</div>
}
