'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/format'

export interface DupeMember {
  id: string
  name: string
  role: string
  score: number | null
  createdAt: string
  sent: boolean
  filename: string | null
}

export interface DupeGroupView {
  reason: 'identical' | 'same-person'
  members: DupeMember[]
}

export default function DuplicatesPanel({ groups }: { groups: DupeGroupView[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  async function keep(group: DupeGroupView, keepId: string) {
    // Never delete someone who has already been emailed; that record is the proof of what was sent.
    const doomed = group.members.filter(m => m.id !== keepId && !m.sent)
    const protectedCount = group.members.filter(m => m.id !== keepId && m.sent).length
    if (!doomed.length) return setMsg('The other copies have already been emailed, so they are kept.')
    const kept = group.members.find(m => m.id === keepId)!
    if (!confirm(`Keep ${kept.name} (${kept.role}) and delete ${doomed.length} other cop${doomed.length === 1 ? 'y' : 'ies'}?${protectedCount ? ` ${protectedCount} already-emailed cop${protectedCount === 1 ? 'y stays' : 'ies stay'}.` : ''}`)) return
    setBusy(keepId)
    setMsg('')
    const results = await Promise.all(doomed.map(m => fetch(`/api/candidates/${m.id}`, { method: 'DELETE' }).then(r => r.ok)))
    setBusy('')
    setMsg(results.every(Boolean) ? `Deleted ${doomed.length}.` : 'Some deletions failed. Refresh and try again.')
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-terra/40 bg-terra/[0.07] p-6 shadow-soft">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">
          Possible duplicates <span className="text-sm font-normal text-inkmut">· {groups.length} group{groups.length === 1 ? '' : 's'}</span>
        </h2>
        {msg && <span className="text-sm text-inkmut">{msg}</span>}
      </div>
      <div className="space-y-4">
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-xl border border-sanddk bg-sandlt p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-terradk">
              {g.reason === 'identical' ? 'Identical CV' : 'Same name and email, different CV text'}
            </p>
            <ul className="divide-y divide-line/60">
              {g.members.map(m => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/candidates/${m.id}`} className="font-semibold text-terradk hover:underline">
                      {m.name}
                    </Link>
                    <span className="ml-2 text-inkmut">
                      {m.role} · {m.score !== null ? `${m.score}/100` : 'not scored'} · added {fmtDate(m.createdAt)}
                      {m.filename ? ` · ${m.filename}` : ''}
                    </span>
                    {m.sent && <span className="badge ml-2 bg-sanddk text-ink/80">emailed</span>}
                  </div>
                  <button className="btn" disabled={!!busy} onClick={() => keep(g, m.id)}>
                    {busy === m.id ? 'Deleting...' : 'Keep this one, delete the rest'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
