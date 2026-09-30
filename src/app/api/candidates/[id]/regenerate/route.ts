import { NextRequest, NextResponse } from 'next/server'
import { draftBrief, draftEmail, reconcile, scoreCandidate } from '@/lib/pipeline'
import { getDb } from '@/lib/db'

export const maxDuration = 60

// what: 'all' (score + email, then refresh ranking/briefs) | 'email' | 'brief'
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { what } = await req.json().catch(() => ({ what: 'all' }))
  try {
    if (what === 'brief') {
      await draftBrief(params.id)
    } else if (what === 'email') {
      await draftEmail(params.id)
    } else {
      await scoreCandidate(params.id)
      await draftEmail(params.id)
      // Scores may have moved the ranking, so refresh briefs / invite-vs-reject kinds for everyone.
      await reconcile()
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (what !== 'brief' && what !== 'email') {
      await getDb().from('candidates').update({ status: 'error', error: (e as Error).message.slice(0, 500) }).eq('id', params.id)
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
