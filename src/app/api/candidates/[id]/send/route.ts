import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPii } from '@/lib/pipeline'
import { sendViaResend } from '@/lib/resend'

// The ONLY place an email leaves the system, and only on an explicit click from the founder.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const { subject, body } = await req.json().catch(() => ({}))
  if (typeof subject !== 'string' || typeof body !== 'string' || !subject.trim() || !body.trim()) {
    return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
  }
  const pii = await getPii(params.id)
  if (!pii?.email) return NextResponse.json({ error: 'No email address on file — add one first' }, { status: 400 })

  // Atomically claim the send so a double-click can never send twice.
  const { data: claimed } = await db
    .from('candidates')
    .update({ email_status: 'sending', email_subject: subject, email_body: body, email_error: null })
    .eq('id', params.id)
    .eq('email_status', 'draft')
    .select('id')
  if (!claimed?.length) return NextResponse.json({ error: 'Already sent (or sending)' }, { status: 409 })

  try {
    const r = await sendViaResend({ to: pii.email, subject, text: body, idempotencyKey: `candidate-${params.id}` })
    await db
      .from('candidates')
      .update({ email_status: 'sent', sent_at: new Date().toISOString(), resend_id: r.id, email_to: r.to })
      .eq('id', params.id)
    return NextResponse.json({ ok: true, to: r.to, id: r.id })
  } catch (e) {
    await db.from('candidates').update({ email_status: 'draft', email_error: (e as Error).message.slice(0, 500) }).eq('id', params.id)
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
