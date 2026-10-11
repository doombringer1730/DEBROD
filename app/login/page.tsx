import Backdrop from '../backdrop'
import LoginForm from './login-form'
import { siteName } from '@/lib/site'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams
  return (
    <>
      <Backdrop />
      <main className="login">
        <LoginForm next={typeof next === 'string' ? next : ''} siteName={siteName} />
      </main>
    </>
  )
}
