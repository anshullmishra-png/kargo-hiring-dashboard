'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsBar({ threshold, topN }: { threshold: number; topN: number }) {
  const router = useRouter()
  const [t, setT] = useState(String(threshold))
  const [n, setN] = useState(String(topN))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function call(url: string, body?: object) {
    setBusy(true)
    setMsg('Working...')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    setMsg(res.ok ? (j.errors?.length ? `Done, ${j.errors.length} failed: ${j.errors[0]}` : 'Done') : j.error || 'Failed')
    router.refresh()
  }

  return (
    <div className="card flex flex-wrap items-end gap-4 text-sm">
      <label>
        <span className="lbl">Invite the top N per role (each gets a brief)</span>
        <input className="input w-24" type="number" min={0} max={50} value={n} onChange={e => setN(e.target.value)} />
      </label>
      <label>
        <span className="lbl">Minimum score to be invited</span>
        <input className="input w-24" type="number" min={0} max={100} value={t} onChange={e => setT(e.target.value)} />
      </label>
      <button
        className="btn"
        disabled={busy || (t === String(threshold) && n === String(topN))}
        onClick={() => call('/api/settings', { threshold: t, topN: n })}
      >
        Apply
      </button>
      <button className="btn" disabled={busy} onClick={() => call('/api/reconcile')} title="Fill in any missing briefs or drafts">
        Refresh briefs &amp; drafts
      </button>
      <span className="text-inkmut">{msg}</span>
    </div>
  )
}
