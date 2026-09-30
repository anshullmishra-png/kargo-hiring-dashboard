'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  status: 'processing' | 'ready' | 'error'
  details: { name: string; email: string; phone: string }
  email: {
    kind: 'invite' | 'reject' | null
    subject: string
    body: string
    status: 'draft' | 'sending' | 'sent'
    sentAt: string | null
    sentTo: string | null
    error: string | null
  }
  hasBrief: boolean
  cvUrl: string | null
}

async function api(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`)
  return j
}

export default function CandidatePanel({ id, status, details, email, hasBrief, cvUrl }: Props) {
  const router = useRouter()
  const [d, setD] = useState(details)
  const [subject, setSubject] = useState(email.subject)
  const [body, setBody] = useState(email.body)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const sent = email.status === 'sent'
  const locked = sent || email.status === 'sending'

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label)
    setMsg(null)
    try {
      const text = await fn()
      if (text) setMsg({ ok: true, text })
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy('')
    }
  }

  const saveDetails = () =>
    run('details', async () => {
      await api(`/api/candidates/${id}`, 'PATCH', d)
      return 'Details saved'
    })

  const saveDraft = () =>
    run('draft', async () => {
      await api(`/api/candidates/${id}`, 'PATCH', { subject, body })
      return 'Draft saved'
    })

  const send = () => {
    if (!d.email) return setMsg({ ok: false, text: 'Add an email address first' })
    if (!confirm(`Send this ${email.kind === 'invite' ? 'interview invite' : 'rejection'} to ${d.name || 'the candidate'} at ${d.email}?`)) return
    run('send', async () => {
      if (JSON.stringify(d) !== JSON.stringify(details)) await api(`/api/candidates/${id}`, 'PATCH', d)
      const r = await api(`/api/candidates/${id}/send`, 'POST', { subject, body })
      return `Sent to ${r.to}`
    })
  }

  const regenerate = (what: 'all' | 'email' | 'brief', label: string) =>
    run(label, async () => {
      await api(`/api/candidates/${id}/regenerate`, 'POST', { what })
      return 'Done'
    })

  const remove = () => {
    if (!confirm('Delete this candidate and their stored CV? This cannot be undone.')) return
    run('delete', async () => {
      await api(`/api/candidates/${id}`, 'DELETE')
      window.location.href = '/'
    })
  }

  const dirty = subject !== email.subject || body !== email.body

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight">
            <span className="step">1</span>Personal details <span className="text-sm font-normal text-inkmut">private, never sent to AI</span>
          </h2>
          {cvUrl && (
            <a className="text-sm text-terradk hover:underline" href={cvUrl} target="_blank" rel="noreferrer">
              View original CV
            </a>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="lbl">Name</span>
            <input className="input" value={d.name} onChange={e => setD({ ...d, name: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="lbl">Email</span>
            <input className="input" value={d.email} onChange={e => setD({ ...d, email: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="lbl">Phone</span>
            <input className="input" value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} />
          </label>
        </div>
        <button className="btn" onClick={saveDetails} disabled={!!busy || JSON.stringify(d) === JSON.stringify(details)}>
          Save details
        </button>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-3 text-lg font-bold tracking-tight">
            <span className="step">2</span>Draft email{' '}
            {email.kind && <span className="text-sm font-normal text-inkmut">· {email.kind === 'invite' ? 'interview invite' : 'rejection'}</span>}
          </h2>
          {sent && (
            <span className="badge bg-sanddk text-ink/80">
              Sent {email.sentAt ? new Date(email.sentAt).toLocaleString() : ''} to {email.sentTo}
            </span>
          )}
        </div>

        {status !== 'ready' && !email.body && <p className="text-sm text-inkmut">No draft yet. Retry scoring below.</p>}

        {(email.body || sent) && (
          <>
            <label className="block text-sm">
              <span className="lbl">To: {d.email || 'no email address'}</span>
              <input className="input" value={subject} disabled={locked} onChange={e => setSubject(e.target.value)} />
            </label>
            <textarea
              className="input h-72 font-mono text-[13px] leading-relaxed"
              value={body}
              disabled={locked}
              onChange={e => setBody(e.target.value)}
            />
            {email.error && <p className="text-sm text-red-600">Last send failed: {email.error}</p>}
            {!locked && (
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-primary !px-5 !py-3 !text-[15px]" onClick={send} disabled={!!busy}>
                  {busy === 'send' ? 'Sending...' : 'Send via Resend'}
                </button>
                <button className="btn" onClick={saveDraft} disabled={!!busy || !dirty}>
                  Save edits
                </button>
                <button
                  className="btn"
                  onClick={() => confirm('Discard your edits and write a fresh draft?') && regenerate('email', 'email')}
                  disabled={!!busy}
                >
                  {busy === 'email' ? 'Writing...' : 'Redraft'}
                </button>
              </div>
            )}
          </>
        )}
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => regenerate('all', 'all')} disabled={!!busy}>
          {busy === 'all' ? 'Scoring...' : status === 'ready' ? 'Re-score' : 'Retry scoring'}
        </button>
        {status === 'ready' && (
          <button className="btn" onClick={() => regenerate('brief', 'brief')} disabled={!!busy}>
            {busy === 'brief' ? 'Writing...' : hasBrief ? 'Rewrite brief' : 'Write brief'}
          </button>
        )}
        <button className="btn btn-danger" onClick={remove} disabled={!!busy}>
          Delete candidate
        </button>
      </div>
    </div>
  )
}
