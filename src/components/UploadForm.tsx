'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'

type Row = { name: string; state: 'waiting' | 'working' | 'done' | 'error'; msg?: string; id?: string }

export default function UploadForm() {
  const [role, setRole] = useState<'PM' | 'SPM'>('PM')
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [finishing, setFinishing] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function run() {
    const files = Array.from(input.current?.files ?? [])
    if (!files.length) return
    setBusy(true)
    setRows(files.map(f => ({ name: f.name, state: 'waiting' })))
    const patch = (i: number, p: Partial<Row>) => setRows(r => r.map((x, j) => (j === i ? { ...x, ...p } : x)))

    for (let i = 0; i < files.length; i++) {
      patch(i, { state: 'working' })
      const fd = new FormData()
      fd.set('file', files[i])
      fd.set('role', role)
      try {
        const res = await fetch('/api/candidates', { method: 'POST', body: fd })
        const j = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
        if (!res.ok) patch(i, { state: 'error', msg: j.error })
        else if (j.status === 'error') patch(i, { state: 'error', msg: j.error, id: j.id })
        else patch(i, { state: 'done', msg: j.name ?? undefined, id: j.id })
      } catch (e) {
        patch(i, { state: 'error', msg: (e as Error).message })
      }
    }
    setFinishing('Ranking and writing briefs...')
    await fetch('/api/reconcile', { method: 'POST' }).catch(() => {})
    setFinishing('')
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Role these CVs applied for</span>
            <select className="input" value={role} onChange={e => setRole(e.target.value as 'PM' | 'SPM')} disabled={busy}>
              <option value="PM">Product Manager</option>
              <option value="SPM">Senior Product Manager</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">CV files (PDF, DOCX or TXT; several at once is fine)</span>
            <input ref={input} type="file" multiple accept=".pdf,.docx,.txt" disabled={busy} className="text-sm" />
          </label>
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? 'Working...' : 'Upload and score'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Name, email and phone are separated first and stored privately. Only the rest of the CV goes to the AI. Each CV takes roughly 10-20 seconds. Upload one role at a time.
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="card divide-y divide-gray-100 p-0 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2">
              <span className="w-5">{r.state === 'done' ? '✓' : r.state === 'error' ? '✗' : r.state === 'working' ? '…' : '·'}</span>
              <span className="flex-1 truncate">{r.name}</span>
              <span className={r.state === 'error' ? 'text-red-600' : 'text-gray-500'}>{r.msg}</span>
              {r.id && (
                <Link className="text-blue-700 hover:underline" href={`/candidates/${r.id}`}>
                  open
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {finishing && <p className="text-sm text-gray-600">{finishing}</p>}
      {!busy && rows.length > 0 && !finishing && (
        <Link className="btn btn-primary" href="/">
          Go to dashboard
        </Link>
      )}
    </div>
  )
}
