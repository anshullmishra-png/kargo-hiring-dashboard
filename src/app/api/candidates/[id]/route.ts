import { NextRequest, NextResponse } from 'next/server'
import { getDb, must } from '@/lib/db'
import { firstNameOf } from '@/lib/pii'
import { draftEmail, getCandidate, getPii, reconcile } from '@/lib/pipeline'

export const maxDuration = 60

// Edit personal details and/or the email draft.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await req.json()
    const db = getDb()
    const cand = await getCandidate(params.id)
    const sent = cand.email_status !== 'draft'

    if (b.applied_role === 'PM' || b.applied_role === 'SPM') {
      if (sent) return NextResponse.json({ error: 'Already emailed, so the role is locked' }, { status: 409 })
      must(
        await db.from('candidates').update({ applied_role: b.applied_role, role_auto: false, role_note: null, brief: null }).eq('id', params.id),
        'change role',
      )
      await draftEmail(params.id) // the draft names the role, so rewrite it
      await reconcile() // ranking changed, so refresh briefs for the new top N
      return NextResponse.json({ ok: true })
    }

    const piiPatch: Record<string, string | null> = {}
    for (const k of ['name', 'email', 'phone'] as const) {
      if (typeof b[k] === 'string') piiPatch[k] = b[k].trim() || null
    }
    if (piiPatch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(piiPatch.email)) {
      return NextResponse.json({ error: 'That email address does not look valid' }, { status: 400 })
    }

    const draftPatch: Record<string, string> = {}
    if (!sent && typeof b.subject === 'string') draftPatch.email_subject = b.subject
    if (!sent && typeof b.body === 'string') draftPatch.email_body = b.body

    // If the name changes, carry the new first name into the existing draft.
    if (!sent && piiPatch.name) {
      const oldFirst = firstNameOf((await getPii(params.id))?.name ?? null)
      const newFirst = firstNameOf(piiPatch.name)
      if (oldFirst && newFirst && oldFirst !== newFirst) {
        const swap = (s: string | null | undefined) => (s ?? '').split(oldFirst).join(newFirst)
        draftPatch.email_body = swap(draftPatch.email_body ?? cand.email_body)
        draftPatch.email_subject = swap(draftPatch.email_subject ?? cand.email_subject)
      }
    }

    if (Object.keys(piiPatch).length) {
      must(await db.from('candidate_pii').update(piiPatch).eq('candidate_id', params.id), 'save details')
    }
    if (Object.keys(draftPatch).length) {
      must(await db.from('candidates').update(draftPatch).eq('id', params.id), 'save draft')
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb()
    const cand = await getCandidate(params.id)
    if (cand.cv_path) await db.storage.from('cvs').remove([cand.cv_path])
    must(await db.from('candidates').delete().eq('id', params.id), 'delete candidate')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
