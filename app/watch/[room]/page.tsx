import Link from 'next/link'
import { parseRoom } from '@/lib/room'
import Room from './room'

// The Supabase keys come from the server here instead of NEXT_PUBLIC_*
// variables, so they only reach browsers that are signed in.
export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { room } = await params
  const source = parseRoom(await searchParams)
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!source || !/^[a-z0-9]{6,32}$/.test(room)) {
    return <Notice>This watch link is broken. Pick something from the search again.</Notice>
  }
  if (!supabaseUrl || !supabaseKey) {
    return <Notice>Set SUPABASE_URL and SUPABASE_ANON_KEY to watch together.</Notice>
  }
  return <Room room={room} source={source} supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <main className="login">
      <div className="card stack">
        <p>{children}</p>
        <Link href="/">‹ Back to search</Link>
      </div>
    </main>
  )
}
