import Link from 'next/link'
import Backdrop from '../backdrop'
import Games from './games'
import { logout } from '../login/actions'
import { siteName } from '@/lib/site'

export const metadata = { title: `Games · ${siteName}` }

export default function GamesPage() {
  return (
    <>
      <Backdrop />
      <main className="page">
        <header className="top">
          <div>
            <h1 className="wordmark">{siteName}</h1>
            <p className="tagline">Arcade · insert coin</p>
          </div>
          <nav className="nav">
            <Link href="/" className="link">Movies &amp; TV</Link>
            <form action={logout}><button type="submit" className="link">Sign out</button></form>
          </nav>
        </header>
        <Games />
      </main>
    </>
  )
}
