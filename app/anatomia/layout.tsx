import type { Metadata, Viewport } from 'next'
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import './anatomia.css'

// Editorial type for an anatomy atlas: a high-contrast optical-size serif for
// the answer word and headings, Plex Sans for the interface, Plex Mono for
// numbers (timer, counts, page references) and the key caps.
const serif = Fraunces({ subsets: ['latin', 'latin-ext'], axes: ['opsz'], variable: '--an-serif' })
const sans = IBM_Plex_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--an-sans' })
const mono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], variable: '--an-mono' })

export const metadata: Metadata = { title: 'Anatomía' }
export const viewport: Viewport = { themeColor: '#111111' }

export default function AnatomiaLayout({ children }: { children: React.ReactNode }) {
  return <div className={`an-root ${serif.variable} ${sans.variable} ${mono.variable}`}>{children}</div>
}
