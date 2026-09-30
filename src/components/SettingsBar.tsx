'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Ranking rules panel (sidebar). Same behaviour as before: apply N / minimum score, or refresh missing briefs and drafts.
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
    <div className="card space-y-3 text-sm">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-inkmut">Ranking rules</h3>
      <div className="grid grid-cols-2 gap-3">
        <label title="How many people per role get an interview invite and a brief">
          <span className="lbl">Invite top N</span>
          <input className="input" type="number" min={0} max={50} value={n} onChange={e => setN(e.target.value)} />
        </label>
        <label title="A candidate needs at least this score to be invited, even inside the top N">
          <span className="lbl">Min. score</span>
          <input className="input" type="number" min={0} max={100} value={t} onChange={e => setT(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          className="btn flex-1"
          disabled={busy || (t === String(threshold) && n === String(topN))}
          onClick={() => call('/api/settings', { threshold: t, topN: n })}
        >
          Apply
        </button>
        <button className="btn flex-1" disabled={busy} onClick={() => call('/api/reconcile')} title="Fill in any missing briefs or drafts">
          Refresh drafts
        </button>
      </div>
      {msg && <p className="text-xs text-inkmut">{msg}</p>}
    </div>
  )
}
