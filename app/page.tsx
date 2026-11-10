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
          <nav className="top-links">
            <a href="/anatomia" className="link">Anatomía</a>
            <form action={logout}><button type="submit" className="link">Sign out</button></form>
          </nav>
        </header>
        <Browser />
      </main>
    </>
  )
}
