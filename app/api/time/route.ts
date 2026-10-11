// The clock the watch-together sync measures itself against.
export function GET() {
  return Response.json({ t: Date.now() })
}

export const dynamic = 'force-dynamic'
