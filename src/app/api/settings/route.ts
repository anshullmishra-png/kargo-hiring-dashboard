import { NextRequest, NextResponse } from 'next/server'
import { getDb, must } from '@/lib/db'
import { reconcile } from '@/lib/pipeline'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { threshold, topN } = await req.json()
    const t = Number(threshold)
    const n = Number(topN)
    if (!(t >= 0 && t <= 100) || !Number.isInteger(n) || n < 0 || n > 50) {
      return NextResponse.json({ error: 'Line must be 0-100 and top-N a whole number 0-50' }, { status: 400 })
    }
    must(
      await getDb().from('settings').upsert([
        { key: 'threshold', value: String(t) },
        { key: 'top_n', value: String(n) },
      ]),
      'save settings',
    )
    // Moving the line can flip invite/reject drafts and change who gets a brief.
    return NextResponse.json(await reconcile())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
