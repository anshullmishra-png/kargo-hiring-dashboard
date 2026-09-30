import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getDb, must } from '@/lib/db'
import { extractCvText } from '@/lib/extract'
import { assertClean, separatePii } from '@/lib/pii'
import { processCandidate } from '@/lib/pipeline'
import { cleanName, normHash } from '@/lib/dupes'

export const maxDuration = 60

// Upload one CV: read it → split personal details from the rest → store both apart → run score + email draft.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    const role = form.get('role')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (role !== 'PM' && role !== 'SPM' && role !== 'AUTO') return NextResponse.json({ error: 'Pick a role' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'File over 8 MB' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const text = await extractCvText(buf, file.name)

    // Step 0 — separate personal details. Fails closed: if anything personal survives, nothing is stored or sent to AI.
    const { pii, redacted } = separatePii(text, file.name)
    assertClean(redacted, pii)

    const db = getDb()

    // Exact repeat of a CV already in the system (same text AND same name)? Skip it: no second scoring run, and
    // point to the existing record. Same text under a different name is kept and flagged instead: it is a
    // different candidate, and a copied CV is something the founder should see.
    const hash = normHash(redacted)
    const existing = must(await db.from('candidates').select('id,cv_text'), 'check duplicates') as { id: string; cv_text: string }[]
    const sameText = existing.filter(e => normHash(e.cv_text) === hash)
    let dupe: { id: string } | undefined
    if (sameText.length) {
      const { data: names } = await db.from('candidate_pii').select('candidate_id,name').in('candidate_id', sameText.map(e => e.id))
      const mine = cleanName(pii.name)
      dupe = (names ?? []).map(n => ({ id: n.candidate_id as string, name: cleanName(n.name as string | null) })).find(n => n.name === mine)
    }
    if (dupe) return NextResponse.json({ id: dupe.id, name: pii.name, status: 'duplicate' })

    const id = randomUUID()
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_')
    const cvPath = `${id}/${safeName}`
    const up = await db.storage.from('cvs').upload(cvPath, buf, { contentType: file.type || 'application/octet-stream' })

    must(
      await db.from('candidates').insert({
        id,
        // 'AUTO' = founder isn't sure; starts as PM and the scorer picks the real fit.
        applied_role: role === 'AUTO' ? 'PM' : role,
        role_auto: role === 'AUTO',
        filename: file.name,
        cv_path: up.error ? null : cvPath,
        cv_text: redacted,
        status: 'processing',
      }),
      'store candidate',
    )
    must(await db.from('candidate_pii').insert({ candidate_id: id, ...pii }), 'store personal details')

    try {
      await processCandidate(id)
      return NextResponse.json({ id, name: pii.name, status: 'ready' })
    } catch (e) {
      return NextResponse.json({ id, name: pii.name, status: 'error', error: (e as Error).message })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 })
  }
}
