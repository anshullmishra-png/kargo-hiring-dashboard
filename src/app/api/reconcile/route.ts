import { NextResponse } from 'next/server'
import { reconcile } from '@/lib/pipeline'

export const maxDuration = 60

export async function POST() {
  try {
    return NextResponse.json(await reconcile())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
