import Link from 'next/link'
import Backdrop from './backdrop'
import Browser from './browser'
import { logout } from './login/actions'
import { siteName } from '@/lib/site'

export default function Home() {
  return (
    <>
      <Backdrop />
      <main className="page">
        <header className="top">
          <div>
            <h1 className="wordmark">{siteName}</h1>
            <p className="tagline">Stream search · est. 1984</p>
          </div>
          <nav className="nav">
            <Link href="/games" className="link">Games</Link>
            <form action={logout}><button type="submit" className="link">Sign out</button></form>
          </nav>
        </header>
        <Browser />
      </main>
    </>
  )
}
